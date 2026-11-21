/**
 * Encoders and decoders of the protocol. The decoders read JSON and check every field, refusing any
 * field a message or an operation does not have, so that nothing malformed reaches a replica or the
 * session log. The encoders check the value the same way before they write it, and write its fields
 * always in the same order, so the same operation is always the same JSON text.
 *
 * @module
 */

import type { Id, IdRange, PositionKey, UserId } from './ids.ts';
import {
  array,
  integer,
  name,
  object,
  oneOf,
  parseJson,
  ProtocolError,
  record,
  tag,
  text,
  UnsupportedVersionError,
} from './json.ts';
import {
  PROTOCOL_VERSION,
  REFUSAL_REASONS,
  SIDES,
  type ClientMessage,
  type JoinSession,
  type Operation,
  type SequencePosition,
  type ServerMessage,
  type SessionJoined,
  type Snapshot,
  type TreePlace,
} from './protocol.ts';
import { decodeBlockContent } from './schema.ts';

/**
 * The number of characters of a text: its Unicode code points. A character outside the Basic
 * Multilingual Plane, such as most emoji, is one character and never split into two halves; an
 * emoji made of several code points, such as a flag, is several characters.
 */
export function characterCount(text: string): number {
  let count = 0;
  for (const _ of text) {
    count++;
  }
  return count;
}

/**
 * Writes an operation as JSON, as it is submitted, relayed and kept in the session log.
 *
 * @throws {ProtocolError} if it is not a valid operation.
 */
export function encodeOperation(value: Operation): string {
  return JSON.stringify(operation(value, 'operation'));
}

/**
 * Checks an operation, such as one parsed from a row of the session log, or one that the client
 * built and is about to apply, and returns a copy with only its fields.
 *
 * @throws {UnsupportedVersionError} if it was written in a version this package does not read.
 * @throws {ProtocolError} if it is not a valid operation.
 */
export function decodeOperation(value: unknown): Operation {
  return operation(value, 'operation');
}

/**
 * Writes a message from the client to Editing as JSON.
 *
 * @throws {ProtocolError} if it is not a valid message.
 */
export function encodeClientMessage(value: ClientMessage): string {
  return JSON.stringify(clientMessage(value, 'message'));
}

/**
 * Reads a message from the client to Editing and checks it.
 *
 * @throws {UnsupportedVersionError} if the client speaks a version this package does not read.
 * @throws {ProtocolError} if it is not JSON or not a message from the client.
 */
export function decodeClientMessage(json: string): ClientMessage {
  return clientMessage(parseJson(json), 'message');
}

/**
 * Writes a message from Editing to the client as JSON.
 *
 * @throws {ProtocolError} if it is not a valid message.
 */
export function encodeServerMessage(value: ServerMessage): string {
  return JSON.stringify(serverMessage(value, 'message'));
}

/**
 * Reads a message from Editing to the client and checks it.
 *
 * @throws {UnsupportedVersionError} if it carries an operation of a version this package does not read.
 * @throws {ProtocolError} if it is not JSON or not a message from Editing.
 */
export function decodeServerMessage(json: string): ServerMessage {
  return serverMessage(parseJson(json), 'message');
}

function clientMessage(value: unknown, path: string): ClientMessage {
  const type = tag(value, path);
  switch (type) {
    case 'joinSession': {
      // The version first, so that a newer client gets an UnsupportedVersionError whatever else
      // its message holds.
      const version = protocolVersion(record(value, path)['version'], `${path}.version`);
      const fields = object(value, path, ['type', 'version'], ['rejoin']);
      const join: JoinSession = { type, version };
      if (fields['rejoin'] === undefined) {
        return join;
      }
      const rejoin = object(fields['rejoin'], `${path}.rejoin`, ['replica', 'seq']);
      return {
        type,
        version,
        rejoin: {
          replica: integer(rejoin['replica'], `${path}.rejoin.replica`, 1),
          seq: integer(rejoin['seq'], `${path}.rejoin.seq`, 0),
        },
      };
    }
    case 'leaveSession':
      object(value, path, ['type']);
      return { type };
    case 'submitEdit': {
      const fields = object(value, path, ['type', 'operation']);
      return { type, operation: operation(fields['operation'], `${path}.operation`) };
    }
    default:
      throw new ProtocolError(`${path}.type`, `is not a message from the client: ${JSON.stringify(type)}`);
  }
}

function serverMessage(value: unknown, path: string): ServerMessage {
  const type = tag(value, path);
  switch (type) {
    case 'sessionJoined': {
      const fields = object(value, path, ['type', 'replica', 'seq'], ['snapshot']);
      const joined: SessionJoined = {
        type,
        replica: integer(fields['replica'], `${path}.replica`, 1),
        seq: integer(fields['seq'], `${path}.seq`, 0),
      };
      if (fields['snapshot'] === undefined) {
        return joined;
      }
      return { ...joined, snapshot: snapshot(fields['snapshot'], `${path}.snapshot`) };
    }
    case 'ack': {
      const fields = object(value, path, ['type', 'id', 'seq']);
      return { type, id: id(fields['id'], `${path}.id`), seq: integer(fields['seq'], `${path}.seq`, 1) };
    }
    case 'refused': {
      const fields = object(value, path, ['type', 'ids', 'reason']);
      return {
        type,
        ids: array(fields['ids'], `${path}.ids`, 1, id),
        reason: oneOf(fields['reason'], `${path}.reason`, REFUSAL_REASONS),
      };
    }
    case 'relayed': {
      const fields = object(value, path, ['type', 'seq', 'operation']);
      return {
        type,
        seq: integer(fields['seq'], `${path}.seq`, 1),
        operation: operation(fields['operation'], `${path}.operation`),
      };
    }
    case 'presence': {
      const fields = object(value, path, ['type', 'collaborators']);
      return { type, collaborators: collaborators(fields['collaborators'], `${path}.collaborators`) };
    }
    case 'sessionClosed':
      object(value, path, ['type']);
      return { type };
    default:
      throw new ProtocolError(`${path}.type`, `is not a message from Editing: ${JSON.stringify(type)}`);
  }
}

function operation(value: unknown, path: string): Operation {
  // The version first: an operation of another version may have a type or fields this one lacks.
  const version = protocolVersion(record(value, path)['version'], `${path}.version`);
  const type = tag(value, path);
  switch (type) {
    case 'insertBlock': {
      const fields = object(value, path, ['type', 'version', 'id', 'at', 'place', 'content']);
      const self = id(fields['id'], `${path}.id`);
      return {
        type,
        version,
        id: self,
        at: sequencePosition(fields['at'], `${path}.at`, self),
        place: treePlace(fields['place'], `${path}.place`, self),
        content: decodeBlockContent(fields['content'], `${path}.content`),
      };
    }
    case 'updateBlock': {
      const fields = object(value, path, ['type', 'version', 'id', 'block', 'content']);
      const self = id(fields['id'], `${path}.id`);
      return {
        type,
        version,
        id: self,
        block: reference(fields['block'], `${path}.block`, self),
        content: decodeBlockContent(fields['content'], `${path}.content`),
      };
    }
    case 'moveBlock': {
      const fields = object(value, path, ['type', 'version', 'id', 'block', 'place']);
      const self = id(fields['id'], `${path}.id`);
      return {
        type,
        version,
        id: self,
        block: reference(fields['block'], `${path}.block`, self),
        place: treePlace(fields['place'], `${path}.place`, self),
      };
    }
    case 'deleteBlock':
    case 'joinBlock': {
      const fields = object(value, path, ['type', 'version', 'id', 'block']);
      const self = id(fields['id'], `${path}.id`);
      return { type, version, id: self, block: reference(fields['block'], `${path}.block`, self) };
    }
    case 'insertText': {
      const fields = object(value, path, ['type', 'version', 'id', 'at', 'text']);
      const self = id(fields['id'], `${path}.id`);
      const typed = text(fields['text'], `${path}.text`);
      if (characterCount(typed) - 1 > Number.MAX_SAFE_INTEGER - self.counter) {
        throw new ProtocolError(`${path}.text`, 'takes counters past the largest safe integer');
      }
      return { type, version, id: self, at: sequencePosition(fields['at'], `${path}.at`, self), text: typed };
    }
    case 'deleteText': {
      const fields = object(value, path, ['type', 'version', 'id', 'ranges']);
      const self = id(fields['id'], `${path}.id`);
      return {
        type,
        version,
        id: self,
        ranges: array(fields['ranges'], `${path}.ranges`, 1, (range, at) => idRange(range, at, self)),
      };
    }
    default:
      throw new ProtocolError(`${path}.type`, `is not an operation: ${JSON.stringify(type)}`);
  }
}

function protocolVersion(value: unknown, path: string): typeof PROTOCOL_VERSION {
  const version = integer(value, path, 1);
  if (version !== PROTOCOL_VERSION) {
    throw new UnsupportedVersionError(path, version, PROTOCOL_VERSION);
  }
  return PROTOCOL_VERSION;
}

function id(value: unknown, path: string): Id {
  const fields = object(value, path, ['replica', 'counter']);
  return {
    replica: integer(fields['replica'], `${path}.replica`, 1),
    counter: integer(fields['counter'], `${path}.counter`, 1),
  };
}

// An id that an operation refers to, which existed before it, so its counter is smaller.
function reference(value: unknown, path: string, self: Id): Id {
  const referred = id(value, path);
  if (referred.counter >= self.counter) {
    throw new ProtocolError(path, 'does not have a smaller counter than the operation');
  }
  return referred;
}

function idRange(value: unknown, path: string, self: Id): IdRange {
  const fields = object(value, path, ['replica', 'counter', 'length']);
  const range: IdRange = {
    replica: integer(fields['replica'], `${path}.replica`, 1),
    counter: integer(fields['counter'], `${path}.counter`, 1),
    length: integer(fields['length'], `${path}.length`, 1),
  };
  if (range.length - 1 >= self.counter - range.counter) {
    throw new ProtocolError(path, 'reaches counters that are not smaller than the operation');
  }
  return range;
}

function sequencePosition(value: unknown, path: string, self: Id): SequencePosition {
  const fields = object(value, path, ['parent', 'side']);
  const side = oneOf(fields['side'], `${path}.side`, SIDES);
  if (fields['parent'] === null) {
    if (side !== 'right') {
      throw new ProtocolError(`${path}.side`, 'is not right, the only side of the root of the sequence');
    }
    return { parent: null, side };
  }
  return { parent: reference(fields['parent'], `${path}.parent`, self), side };
}

function treePlace(value: unknown, path: string, self: Id): TreePlace {
  const fields = object(value, path, ['parent', 'key']);
  return {
    parent: fields['parent'] === null ? null : reference(fields['parent'], `${path}.parent`, self),
    key: positionKey(fields['key'], `${path}.key`),
  };
}

const BASE_62 = /^[0-9A-Za-z]+$/u;
// The smallest key, before which no key can be made.
const SMALLEST_KEY = `A${'0'.repeat(26)}`;

function positionKey(value: unknown, path: string): PositionKey {
  const key = name(value, path);
  if (!BASE_62.test(key)) {
    throw new ProtocolError(path, 'has a character that is not a base-62 digit');
  }
  // The first letter gives the number of digits of the integer part: 2 for "a", up to 27 for "z",
  // and 2 for "Z", up to 27 for "A".
  const head = key.charCodeAt(0);
  const integerDigits =
    head >= 0x61 ? head - 0x61 + 2 : head >= 0x41 && head <= 0x5a ? 0x5a - head + 2 : Number.NaN;
  if (Number.isNaN(integerDigits)) {
    throw new ProtocolError(path, 'does not start with a letter');
  }
  if (key.length < integerDigits) {
    throw new ProtocolError(path, 'is shorter than its integer part');
  }
  if (key.length > integerDigits && key.endsWith('0')) {
    throw new ProtocolError(path, 'has a fractional part that ends in 0');
  }
  if (key === SMALLEST_KEY) {
    throw new ProtocolError(path, 'is the smallest key, with no room before it');
  }
  return key;
}

function snapshot(value: unknown, path: string): Snapshot {
  const fields = object(value, path, ['operations']);
  return { operations: array(fields['operations'], `${path}.operations`, 0, operation) };
}

function collaborators(value: unknown, path: string): UserId[] {
  const users = array(value, path, 0, name);
  if (new Set(users).size !== users.length) {
    throw new ProtocolError(path, 'lists a user more than once');
  }
  return users;
}
