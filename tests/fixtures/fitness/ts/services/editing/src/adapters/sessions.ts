// Violates ADR-03: an adapter other than the consumer of the events of Membership names one, bypassing its anticorruption layer
import type { MemberRemoved } from './events/member-removed.v1.ts';

export type Removed = MemberRemoved;
