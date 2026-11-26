// Of the domain and the application services of Editing, only the domain imports the CRDT, the model of the document (ADR-01), and it re-exports only the types the application services name. The adapters import the rest, such as the messages of the session on the WebSocket, from `@gotion/crdt` directly.
export type { Id, Operation, PageId, Seq } from '@gotion/crdt';
