import type {
  CanonicalStep,
  CanonicalTransition,
  CanonicalWorkflow,
  StepId,
} from '../model/workflow';

export interface IndexedCanonicalStep {
  readonly step: CanonicalStep;
  readonly index: number;
}

export interface IndexedCanonicalTransition {
  readonly transition: CanonicalTransition;
  readonly index: number;
}

export interface WorkflowGraphIndex {
  readonly steps: readonly IndexedCanonicalStep[];
  readonly transitions: readonly IndexedCanonicalTransition[];
  /** First canonical occurrence for a step ID. Duplicate occurrences remain visible in `stepOccurrencesById`. */
  readonly stepById: ReadonlyMap<StepId, IndexedCanonicalStep>;
  readonly stepOccurrencesById: ReadonlyMap<StepId, readonly IndexedCanonicalStep[]>;
  /** Authored incident transitions whose referenced endpoint exists, even when the opposite endpoint is broken. */
  readonly incomingTransitionsByStepId: ReadonlyMap<StepId, readonly IndexedCanonicalTransition[]>;
  readonly outgoingTransitionsByStepId: ReadonlyMap<StepId, readonly IndexedCanonicalTransition[]>;
  /** Traversable transitions require both source and target step IDs to exist. */
  readonly validTransitions: readonly IndexedCanonicalTransition[];
  readonly validIncomingTransitionsByStepId: ReadonlyMap<
    StepId,
    readonly IndexedCanonicalTransition[]
  >;
  readonly validOutgoingTransitionsByStepId: ReadonlyMap<
    StepId,
    readonly IndexedCanonicalTransition[]
  >;
  readonly explicitStartSteps: readonly IndexedCanonicalStep[];
  readonly explicitEndSteps: readonly IndexedCanonicalStep[];
  readonly entryCandidates: readonly IndexedCanonicalStep[];
  readonly terminalCandidates: readonly IndexedCanonicalStep[];
}

const append = <K, V>(map: Map<K, V[]>, key: K, value: V): void => {
  const values = map.get(key);
  if (values === undefined) {
    map.set(key, [value]);
    return;
  }
  values.push(value);
};

const freezeMapArrays = <K, V>(source: ReadonlyMap<K, V[]>): ReadonlyMap<K, readonly V[]> => {
  const result = new Map<K, readonly V[]>();
  for (const [key, values] of source) {
    result.set(key, values);
  }
  return result;
};

/**
 * Build deterministic, framework-independent graph indexes without mutating the canonical workflow.
 * Broken references remain represented in `transitions` but are excluded from traversable adjacency.
 */
export const buildWorkflowGraphIndex = (workflow: CanonicalWorkflow): WorkflowGraphIndex => {
  const steps = workflow.steps.map((step, index) => ({ step, index }));
  const transitions = workflow.transitions.map((transition, index) => ({ transition, index }));

  const stepById = new Map<StepId, IndexedCanonicalStep>();
  const stepOccurrencesById = new Map<StepId, IndexedCanonicalStep[]>();
  const incomingTransitionsByStepId = new Map<StepId, IndexedCanonicalTransition[]>();
  const outgoingTransitionsByStepId = new Map<StepId, IndexedCanonicalTransition[]>();
  const validIncomingTransitionsByStepId = new Map<StepId, IndexedCanonicalTransition[]>();
  const validOutgoingTransitionsByStepId = new Map<StepId, IndexedCanonicalTransition[]>();

  for (const indexedStep of steps) {
    append(stepOccurrencesById, indexedStep.step.id, indexedStep);
    if (!stepById.has(indexedStep.step.id)) {
      stepById.set(indexedStep.step.id, indexedStep);
      incomingTransitionsByStepId.set(indexedStep.step.id, []);
      outgoingTransitionsByStepId.set(indexedStep.step.id, []);
      validIncomingTransitionsByStepId.set(indexedStep.step.id, []);
      validOutgoingTransitionsByStepId.set(indexedStep.step.id, []);
    }
  }

  const validTransitions: IndexedCanonicalTransition[] = [];
  for (const indexedTransition of transitions) {
    const { sourceStepId, targetStepId } = indexedTransition.transition;
    const sourceExists = stepById.has(sourceStepId);
    const targetExists = stepById.has(targetStepId);

    if (sourceExists) {
      append(outgoingTransitionsByStepId, sourceStepId, indexedTransition);
    }
    if (targetExists) {
      append(incomingTransitionsByStepId, targetStepId, indexedTransition);
    }
    if (!sourceExists || !targetExists) {
      continue;
    }

    validTransitions.push(indexedTransition);
    append(validOutgoingTransitionsByStepId, sourceStepId, indexedTransition);
    append(validIncomingTransitionsByStepId, targetStepId, indexedTransition);
  }

  const explicitStartSteps = steps.filter(({ step }) => step.type === 'start');
  const explicitEndSteps = steps.filter(({ step }) => step.type === 'end');
  const entryCandidates = steps.filter(
    ({ step }) => (validIncomingTransitionsByStepId.get(step.id)?.length ?? 0) === 0,
  );
  const terminalCandidates = steps.filter(
    ({ step }) => (validOutgoingTransitionsByStepId.get(step.id)?.length ?? 0) === 0,
  );

  return {
    steps,
    transitions,
    stepById,
    stepOccurrencesById: freezeMapArrays(stepOccurrencesById),
    incomingTransitionsByStepId: freezeMapArrays(incomingTransitionsByStepId),
    outgoingTransitionsByStepId: freezeMapArrays(outgoingTransitionsByStepId),
    validTransitions,
    validIncomingTransitionsByStepId: freezeMapArrays(validIncomingTransitionsByStepId),
    validOutgoingTransitionsByStepId: freezeMapArrays(validOutgoingTransitionsByStepId),
    explicitStartSteps,
    explicitEndSteps,
    entryCandidates,
    terminalCandidates,
  };
};
