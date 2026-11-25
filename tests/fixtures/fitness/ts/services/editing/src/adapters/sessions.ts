// Violates ADR-03: an adapter outside roles/ reads an event of Membership instead of going through its anticorruption layer
import type { MemberRemoved } from './events/member-removed.v1.ts';

export type Removed = MemberRemoved;
