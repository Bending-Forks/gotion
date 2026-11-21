/**
 * The block schema: the types of block of US-07 and the page block, and the styles of the text.
 *
 * A block holds its type and the fields that type needs, never its text: the text of every block
 * is in the one sequence of characters of its page, after the marker of the block (ADR-01). A new
 * type of block is a new member of {@link BlockContent} and a new case of
 * {@link decodeBlockContent}, both in this file, and needs no new operation (QA-09).
 *
 * @module
 */

import type { PageId } from './ids.ts';
import { boolean, name, object, oneOf, ProtocolError, tag } from './json.ts';

/** Formatted text, the paragraph of Markdown. */
export type TextContent = { readonly type: 'text' };

/** The levels of a heading, as in Markdown. */
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

/** A level of a heading, from 1 to 6. */
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

/** A heading, with its level. */
export type HeadingContent = { readonly type: 'heading'; readonly level: HeadingLevel };

/** An item of a bulleted list. */
export type BulletedListContent = { readonly type: 'bulletedList' };

/** An item of a numbered list. Its number comes from its place among the items around it. */
export type NumberedListContent = { readonly type: 'numberedList' };

/** An item of a to-do list, with its checkbox. */
export type ToDoContent = { readonly type: 'toDo'; readonly checked: boolean };

/**
 * A code block. Its text is shown plain: a replica ignores the styles of its characters, which a
 * concurrent operation may have left there. It may name its language in one word, the one written
 * after the opening fence of a Markdown code block (`python`): no whitespace, no backtick and no
 * control character. Without a language the field is absent.
 */
export type CodeContent = { readonly type: 'code'; readonly language?: string };

/**
 * The block that stands for a sub-page, and holds nothing but it. It never becomes another type,
 * no other block becomes one, and it is never updated (Page Block Tree). It has no text: a
 * character that a concurrent insertion puts after its marker belongs to the nearest block before
 * it in the sequence that is not a page block.
 */
export type PageBlockContent = { readonly type: 'pageBlock'; readonly subPage: PageId };

/** What a block holds besides its text: its type and the fields of that type. */
export type BlockContent =
  | TextContent
  | HeadingContent
  | BulletedListContent
  | NumberedListContent
  | ToDoContent
  | CodeContent
  | PageBlockContent;

/** The type of a block. */
export type BlockType = BlockContent['type'];

/** Every type of block. */
export const BLOCK_TYPES: readonly BlockType[] = [
  'text',
  'heading',
  'bulletedList',
  'numberedList',
  'toDo',
  'code',
  'pageBlock',
];

/**
 * The styles of the text, the ones Markdown can express (BR-03): bold, italic, inline code and
 * strikethrough, and links, which also carry their URL. Styles are marks over the characters of
 * the sequence (ADR-01); the operation that sets them comes with the styles as marks.
 */
export const MARKS = ['bold', 'italic', 'code', 'strikethrough', 'link'] as const;

/** A style of the text. */
export type Mark = (typeof MARKS)[number];

/**
 * Checks that `value` is the content of a block, with exactly the fields of its type and each in
 * its range, and returns a copy with only those fields.
 *
 * @throws {ProtocolError} if it is not.
 */
export function decodeBlockContent(value: unknown, path: string): BlockContent {
  const type = tag(value, path);
  switch (type) {
    case 'text':
    case 'bulletedList':
    case 'numberedList':
      object(value, path, ['type']);
      return { type };
    case 'heading': {
      const fields = object(value, path, ['type', 'level']);
      return { type, level: oneOf(fields['level'], `${path}.level`, HEADING_LEVELS) };
    }
    case 'toDo': {
      const fields = object(value, path, ['type', 'checked']);
      return { type, checked: boolean(fields['checked'], `${path}.checked`) };
    }
    case 'code': {
      const fields = object(value, path, ['type'], ['language']);
      if (fields['language'] === undefined) {
        return { type };
      }
      const language = name(fields['language'], `${path}.language`);
      if (/[\s`]/u.test(language)) {
        throw new ProtocolError(`${path}.language`, 'is not one word');
      }
      return { type, language };
    }
    case 'pageBlock': {
      const fields = object(value, path, ['type', 'subPage']);
      return { type, subPage: name(fields['subPage'], `${path}.subPage`) };
    }
    default:
      throw new ProtocolError(`${path}.type`, `is not a type of block: ${JSON.stringify(type)}`);
  }
}
