import type { CanonicalMetadata } from '../metadata/json-value';
import type { CanonicalStep, CanonicalTransition, CanonicalWorkflow } from '../model/workflow';
import type {
  NormalizationCompatibleStepDefinition,
  NormalizationCompatibleTransitionDefinition,
  NormalizationCompatibleWorkflowDefinition,
} from './native-definition';
import { createTransitionInternalId } from './transition-identity';

const EMPTY_METADATA: CanonicalMetadata = Object.freeze({});

const normalizeMetadata = (metadata: CanonicalMetadata | undefined): CanonicalMetadata =>
  metadata ?? EMPTY_METADATA;

const normalizeStep = (step: NormalizationCompatibleStepDefinition): CanonicalStep => ({
  id: step.id,
  label: step.label,
  type: step.type ?? 'action',
  ...(step.description === undefined ? {} : { description: step.description }),
  ...(step.status === undefined ? {} : { status: step.status }),
  metadata: normalizeMetadata(step.metadata),
});

const transitionPairKey = (transition: NormalizationCompatibleTransitionDefinition): string =>
  JSON.stringify([transition.source, transition.target]);

const normalizeTransitions = (
  transitions: readonly NormalizationCompatibleTransitionDefinition[],
): readonly CanonicalTransition[] => {
  const occurrencesByPair = new Map<string, number>();

  return transitions.map((transition) => {
    const pairKey = transitionPairKey(transition);
    const occurrenceIndex = occurrencesByPair.get(pairKey) ?? 0;
    occurrencesByPair.set(pairKey, occurrenceIndex + 1);

    return {
      internalId: createTransitionInternalId(transition.source, transition.target, occurrenceIndex),
      ...(transition.id === undefined ? {} : { sourceDefinedId: transition.id }),
      sourceStepId: transition.source,
      targetStepId: transition.target,
      ...(transition.label === undefined ? {} : { label: transition.label }),
      ...(transition.condition === undefined ? {} : { condition: transition.condition }),
      metadata: normalizeMetadata(transition.metadata),
    };
  });
};

/**
 * Normalize a structurally compatible native FlowLens V0.1 definition into
 * the P02 canonical model. This function deliberately performs no P04/P05
 * validation or semantic repair.
 */
export const normalizeWorkflowDefinition = (
  definition: NormalizationCompatibleWorkflowDefinition,
): CanonicalWorkflow => ({
  schemaVersion: definition.schemaVersion,
  ...(definition.id === undefined ? {} : { id: definition.id }),
  name: definition.name,
  ...(definition.description === undefined ? {} : { description: definition.description }),
  steps: definition.steps.map(normalizeStep),
  transitions: normalizeTransitions(definition.transitions),
  metadata: normalizeMetadata(definition.metadata),
});
