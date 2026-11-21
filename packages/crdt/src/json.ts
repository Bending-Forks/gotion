/**
 * Readers that check a value parsed from JSON and fail with a {@link ProtocolError} that names
 * where the value went wrong. They are used by the decoders of the schema and of the protocol.
 *
 * @module
 */

/** A message or an operation that does not follow the protocol. */
export class ProtocolError extends Error {
  /** Where the value went wrong, as a path from the root of the message, such as `operation.id`. */
  readonly path: string;

  constructor(path: string, problem: string) {
    super(`${path}: ${problem}`);
    this.name = 'ProtocolError';
    this.path = path;
  }
}

/**
 * A message or an operation written in a version of the protocol that this package does not read.
 * Editing closes the WebSocket of a client that speaks another version, and the client reloads.
 */
export class UnsupportedVersionError extends ProtocolError {
  /** The version the value was written in. */
  readonly version: number;

  constructor(path: string, version: number, supported: number) {
    super(path, `is version ${version} of the protocol, and this package reads version ${supported}`);
    this.name = 'UnsupportedVersionError';
    this.version = version;
  }
}

/** Parses JSON text, turning a syntax error into a {@link ProtocolError}. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ProtocolError('message', 'is not JSON');
  }
}

/** Checks that `value` is an object that is not an array, and returns it as a record. */
export function record(value: unknown, path: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProtocolError(path, 'is not an object');
  }
  return value as Record<string, unknown>;
}

/**
 * Checks that `value` is an object with every key of `required`, possibly some of `optional`, and no
 * other key, and returns it as a record. A key whose value is `undefined` counts as absent, as it
 * does in JSON.
 */
export function object(
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = [],
): Readonly<Record<string, unknown>> {
  const fields = record(value, path);
  for (const key of Object.keys(fields)) {
    if (!required.includes(key) && !optional.includes(key) && fields[key] !== undefined) {
      throw new ProtocolError(path, `has no field ${JSON.stringify(key)}`);
    }
  }
  for (const key of required) {
    if (fields[key] === undefined) {
      throw new ProtocolError(path, `lacks the field ${JSON.stringify(key)}`);
    }
  }
  return fields;
}

/**
 * Returns the `type` of an object, before its other fields are checked against the fields of that
 * type.
 */
export function tag(value: unknown, path: string): string {
  const type = record(value, path)['type'];
  if (typeof type !== 'string') {
    throw new ProtocolError(`${path}.type`, 'is not a string');
  }
  return type;
}

/** Checks that `value` is a safe integer not lower than `min`. */
export function integer(value: unknown, path: string, min: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new ProtocolError(path, 'is not an integer');
  }
  if (value < min) {
    throw new ProtocolError(path, `is lower than ${min}`);
  }
  return value;
}

/** Checks that `value` is a boolean. */
export function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ProtocolError(path, 'is not a boolean');
  }
  return value;
}

/** Checks that `value` is one of `options`. */
export function oneOf<T>(value: unknown, path: string, options: readonly T[]): T {
  if (!options.includes(value as T)) {
    throw new ProtocolError(path, `is not one of ${options.map((option) => JSON.stringify(option)).join(', ')}`);
  }
  return value as T;
}

/** Checks that `value` is an array with at least `min` items, and reads each item with `item`. */
export function array<T>(
  value: unknown,
  path: string,
  min: number,
  item: (value: unknown, path: string) => T,
): T[] {
  if (!Array.isArray(value)) {
    throw new ProtocolError(path, 'is not an array');
  }
  if (value.length < min) {
    throw new ProtocolError(path, `has fewer than ${min} items`);
  }
  return value.map((element, index) => item(element, `${path}[${index}]`));
}

// Control characters (C0, DEL and C1) and the Unicode line and paragraph separators. PostgreSQL
// cannot store NUL in text or jsonb, and the only line break of the protocol is the line feed.
const CONTROL = /[\p{Cc}\u2028\u2029]/u;
const CONTROL_BUT_TAB_AND_LINE_FEED = /[\u2028\u2029]|(?![\t\n])\p{Cc}/u;

function characters(value: unknown, path: string, forbidden: RegExp, which: string): string {
  if (typeof value !== 'string') {
    throw new ProtocolError(path, 'is not a string');
  }
  if (value === '') {
    throw new ProtocolError(path, 'is empty');
  }
  if (!value.isWellFormed()) {
    throw new ProtocolError(path, 'has half of a surrogate pair');
  }
  if (forbidden.test(value)) {
    throw new ProtocolError(path, `has ${which}`);
  }
  return value;
}

/**
 * Checks that `value` is text a collaborator typed: a non-empty, well-formed string whose only
 * control characters are the tab and the line feed.
 */
export function text(value: unknown, path: string): string {
  return characters(value, path, CONTROL_BUT_TAB_AND_LINE_FEED, 'a control character other than a tab or a line feed');
}

/**
 * Checks that `value` is a name, such as an identity or the language of a code block: a
 * non-empty, well-formed string with no control character.
 */
export function name(value: unknown, path: string): string {
  return characters(value, path, CONTROL, 'a control character');
}
