// The domain is the only layer of Editing that imports the CRDT, the model of the document (ADR-01). It re-exports only the types the application services name; the messages of the session on the WebSocket stay with its adapter.
export type { Id, Operation, PageId, Seq } from '@gotion/crdt';
