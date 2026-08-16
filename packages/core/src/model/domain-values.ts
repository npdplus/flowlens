export const CANONICAL_STEP_TYPES = ['start', 'action', 'decision', 'end'] as const;

export type CanonicalStepType = (typeof CANONICAL_STEP_TYPES)[number];

export const CANONICAL_STEP_STATUSES = [
  'pending',
  'active',
  'success',
  'warning',
  'failed',
  'skipped',
] as const;

export type CanonicalStepStatus = (typeof CANONICAL_STEP_STATUSES)[number];
