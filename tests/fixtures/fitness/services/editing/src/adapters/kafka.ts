// Violates ADR-03: an event of Membership outside the adapter of AccessLookupService
import type { MemberRemoved } from './events/member-removed.v1.ts';

export type Removed = MemberRemoved;
