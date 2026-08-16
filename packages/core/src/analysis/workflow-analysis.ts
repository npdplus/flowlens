import { collectWeaklyConnectedStepIdComponents } from '../graph/weak-components';
import {
  buildWorkflowGraphIndex,
  type IndexedCanonicalStep,
  type WorkflowGraphIndex,
} from '../graph/workflow-graph-index';
import type { CanonicalWorkflow, StepId } from '../model/workflow';

export interface WorkflowEntryAnalysis {
  readonly candidateStepIds: readonly StepId[];
  readonly candidateCount: number;
  readonly explicitStartStepIds: readonly StepId[];
  readonly explicitStartCount: number;
}

export interface WorkflowTerminalAnalysis {
  readonly candidateStepIds: readonly StepId[];
  readonly candidateCount: number;
  readonly explicitEndStepIds: readonly StepId[];
  readonly explicitEndCount: number;
}

export interface WorkflowBranchingAnalysis {
  readonly stepIds: readonly StepId[];
  readonly stepCount: number;
  readonly maximumOutgoingTransitionCount: number;
}

export interface WorkflowCycleGroup {
  readonly stepIds: readonly StepId[];
}

export interface WorkflowCycleAnalysis {
  /** True for either a multi-step directed cycle or a valid self-loop. */
  readonly hasDirectedCycle: boolean;
  /** Multi-step strongly connected cycle groups. Self-loops are summarized separately. */
  readonly nonSelfCycleGroups: readonly WorkflowCycleGroup[];
  readonly nonSelfCycleGroupCount: number;
  /** Canonical-order union of multi-step cycle members and self-loop steps. */
  readonly cyclicStepIds: readonly StepId[];
}

export interface WorkflowSelfLoopAnalysis {
  readonly transitionCount: number;
  readonly stepIds: readonly StepId[];
  readonly stepCount: number;
}

export interface WorkflowComponentAnalysis {
  readonly stepIdGroups: readonly (readonly StepId[])[];
  readonly count: number;
  readonly largestSize: number;
}

export interface WorkflowAnalysisResult {
  readonly stepCount: number;
  readonly transitionCount: number;
  readonly decisionStepCount: number;
  readonly entry: WorkflowEntryAnalysis;
  readonly terminal: WorkflowTerminalAnalysis;
  readonly branching: WorkflowBranchingAnalysis;
  readonly cycles: WorkflowCycleAnalysis;
  readonly selfLoops: WorkflowSelfLoopAnalysis;
  readonly components: WorkflowComponentAnalysis;
}

interface DfsFrame {
  readonly stepId: StepId;
  nextNeighborIndex: number;
}

const uniqueStepIds = (steps: readonly IndexedCanonicalStep[]): readonly StepId[] => {
  const seen = new Set<StepId>();
  const result: StepId[] = [];

  for (const { step } of steps) {
    if (seen.has(step.id)) continue;
    seen.add(step.id);
    result.push(step.id);
  }

  return result;
};

const buildDirectedAdjacency = (
  graph: WorkflowGraphIndex,
): {
  readonly outgoing: ReadonlyMap<StepId, readonly StepId[]>;
  readonly incoming: ReadonlyMap<StepId, readonly StepId[]>;
} => {
  const stepIds = [...graph.stepById.keys()];
  const outgoing = new Map<StepId, StepId[]>(stepIds.map((stepId) => [stepId, []]));
  const incoming = new Map<StepId, StepId[]>(stepIds.map((stepId) => [stepId, []]));

  for (const { transition } of graph.validTransitions) {
    outgoing.get(transition.sourceStepId)?.push(transition.targetStepId);
    incoming.get(transition.targetStepId)?.push(transition.sourceStepId);
  }

  return { outgoing, incoming };
};

const collectStronglyConnectedStepIdGroups = (
  graph: WorkflowGraphIndex,
): readonly (readonly StepId[])[] => {
  const stepIds = [...graph.stepById.keys()];
  const canonicalIndexByStepId = new Map<StepId, number>(
    stepIds.map((stepId, index) => [stepId, index]),
  );
  const { outgoing, incoming } = buildDirectedAdjacency(graph);
  const visited = new Set<StepId>();
  const finishOrder: StepId[] = [];

  for (const rootStepId of stepIds) {
    if (visited.has(rootStepId)) continue;

    visited.add(rootStepId);
    const stack: DfsFrame[] = [{ stepId: rootStepId, nextNeighborIndex: 0 }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame === undefined) break;
      const neighbors = outgoing.get(frame.stepId) ?? [];

      if (frame.nextNeighborIndex < neighbors.length) {
        const neighborStepId = neighbors[frame.nextNeighborIndex];
        frame.nextNeighborIndex += 1;
        if (neighborStepId === undefined || visited.has(neighborStepId)) continue;
        visited.add(neighborStepId);
        stack.push({ stepId: neighborStepId, nextNeighborIndex: 0 });
        continue;
      }

      finishOrder.push(frame.stepId);
      stack.pop();
    }
  }

  const assigned = new Set<StepId>();
  const groups: StepId[][] = [];

  for (let index = finishOrder.length - 1; index >= 0; index -= 1) {
    const rootStepId = finishOrder[index];
    if (rootStepId === undefined || assigned.has(rootStepId)) continue;

    const group: StepId[] = [];
    const stack: StepId[] = [rootStepId];
    assigned.add(rootStepId);

    while (stack.length > 0) {
      const stepId = stack.pop();
      if (stepId === undefined) continue;
      group.push(stepId);

      const neighbors = incoming.get(stepId) ?? [];
      for (let neighborIndex = neighbors.length - 1; neighborIndex >= 0; neighborIndex -= 1) {
        const neighborStepId = neighbors[neighborIndex];
        if (neighborStepId === undefined || assigned.has(neighborStepId)) continue;
        assigned.add(neighborStepId);
        stack.push(neighborStepId);
      }
    }

    group.sort(
      (left, right) =>
        (canonicalIndexByStepId.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (canonicalIndexByStepId.get(right) ?? Number.MAX_SAFE_INTEGER),
    );
    groups.push(group);
  }

  groups.sort(
    (left, right) =>
      (canonicalIndexByStepId.get(left[0] ?? '') ?? Number.MAX_SAFE_INTEGER) -
      (canonicalIndexByStepId.get(right[0] ?? '') ?? Number.MAX_SAFE_INTEGER),
  );

  return groups;
};

const analyzeBranching = (graph: WorkflowGraphIndex): WorkflowBranchingAnalysis => {
  const branchingStepIds: StepId[] = [];
  let maximumOutgoingTransitionCount = 0;

  for (const stepId of graph.stepById.keys()) {
    // Branching is an authored characteristic. P05 deliberately retains an authored edge when
    // this endpoint exists even if the opposite endpoint is broken.
    const outgoingCount = graph.outgoingTransitionsByStepId.get(stepId)?.length ?? 0;
    maximumOutgoingTransitionCount = Math.max(maximumOutgoingTransitionCount, outgoingCount);
    if (outgoingCount > 1) {
      branchingStepIds.push(stepId);
    }
  }

  return {
    stepIds: branchingStepIds,
    stepCount: branchingStepIds.length,
    maximumOutgoingTransitionCount,
  };
};

const analyzeCycles = (
  graph: WorkflowGraphIndex,
): {
  readonly cycles: WorkflowCycleAnalysis;
  readonly selfLoops: WorkflowSelfLoopAnalysis;
} => {
  const stepIds = [...graph.stepById.keys()];
  const selfLoopStepIdSet = new Set<StepId>();
  let selfLoopTransitionCount = 0;

  for (const { transition } of graph.validTransitions) {
    if (transition.sourceStepId !== transition.targetStepId) continue;
    selfLoopTransitionCount += 1;
    selfLoopStepIdSet.add(transition.sourceStepId);
  }

  const nonSelfCycleGroups = collectStronglyConnectedStepIdGroups(graph)
    .filter((group) => group.length > 1)
    .map((stepIdGroup) => ({ stepIds: stepIdGroup }));
  const cyclicStepIdSet = new Set<StepId>(selfLoopStepIdSet);
  for (const group of nonSelfCycleGroups) {
    for (const stepId of group.stepIds) {
      cyclicStepIdSet.add(stepId);
    }
  }

  const selfLoopStepIds = stepIds.filter((stepId) => selfLoopStepIdSet.has(stepId));
  const cyclicStepIds = stepIds.filter((stepId) => cyclicStepIdSet.has(stepId));

  return {
    cycles: {
      hasDirectedCycle: nonSelfCycleGroups.length > 0 || selfLoopTransitionCount > 0,
      nonSelfCycleGroups,
      nonSelfCycleGroupCount: nonSelfCycleGroups.length,
      cyclicStepIds,
    },
    selfLoops: {
      transitionCount: selfLoopTransitionCount,
      stepIds: selfLoopStepIds,
      stepCount: selfLoopStepIds.length,
    },
  };
};

/**
 * Derive deterministic, framework-independent workflow facts without changing workflow validity.
 * Analysis reads workflow content as inert data and never mutates the canonical workflow.
 */
export const analyzeWorkflow = (workflow: CanonicalWorkflow): WorkflowAnalysisResult => {
  const graph = buildWorkflowGraphIndex(workflow);
  const entryCandidateStepIds = uniqueStepIds(graph.entryCandidates);
  const terminalCandidateStepIds = uniqueStepIds(graph.terminalCandidates);
  const explicitStartStepIds = graph.explicitStartSteps.map(({ step }) => step.id);
  const explicitEndStepIds = graph.explicitEndSteps.map(({ step }) => step.id);
  const branching = analyzeBranching(graph);
  const { cycles, selfLoops } = analyzeCycles(graph);
  const componentStepIdGroups = collectWeaklyConnectedStepIdComponents(graph);
  const largestComponentSize = componentStepIdGroups.reduce(
    (largestSize, component) => Math.max(largestSize, component.length),
    0,
  );

  return {
    stepCount: workflow.steps.length,
    transitionCount: workflow.transitions.length,
    decisionStepCount: workflow.steps.filter((step) => step.type === 'decision').length,
    entry: {
      candidateStepIds: entryCandidateStepIds,
      candidateCount: entryCandidateStepIds.length,
      explicitStartStepIds,
      explicitStartCount: explicitStartStepIds.length,
    },
    terminal: {
      candidateStepIds: terminalCandidateStepIds,
      candidateCount: terminalCandidateStepIds.length,
      explicitEndStepIds,
      explicitEndCount: explicitEndStepIds.length,
    },
    branching,
    cycles,
    selfLoops,
    components: {
      stepIdGroups: componentStepIdGroups,
      count: componentStepIdGroups.length,
      largestSize: largestComponentSize,
    },
  };
};
