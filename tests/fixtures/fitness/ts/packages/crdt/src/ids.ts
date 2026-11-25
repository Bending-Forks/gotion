// Violates the purity of the CRDT: a node: module, which neither the browser nor the domain of Editing may depend on
import { randomUUID } from 'node:crypto';

export const newId = () => randomUUID();
