import type { StepId, TransitionInternalId } from '../model/workflow';

/**
 * Build a deterministic internal transition identity.
 *
 * Length-prefixed endpoint IDs avoid delimiter collisions. The occurrence index
 * is counted only among transitions with the same source/target pair, using
 * stable source transition order as the V0.1 tie-break for repeated pairs.
 */
export const createTransitionInternalId = (
  sourceStepId: StepId,
  targetStepId: StepId,
  occurrenceIndex: number,
): TransitionInternalId =>
  `transition:${sourceStepId.length}:${sourceStepId}:${targetStepId.length}:${targetStepId}:${occurrenceIndex}`;
