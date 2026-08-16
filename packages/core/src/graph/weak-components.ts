import type { StepId } from '../model/workflow';
import type { WorkflowGraphIndex } from './workflow-graph-index';

const addNeighbor = (
  neighbors: Map<StepId, Set<StepId>>,
  sourceStepId: StepId,
  targetStepId: StepId,
): void => {
  neighbors.get(sourceStepId)?.add(targetStepId);
};

/**
 * Collect weakly connected components from the traversable graph basis shared by P05 and P06.
 * Components and their members follow canonical step order and broken references never create edges.
 */
export const collectWeaklyConnectedStepIdComponents = (
  graph: WorkflowGraphIndex,
): readonly (readonly StepId[])[] => {
  const stepIds = [...graph.stepById.keys()];
  const canonicalIndexByStepId = new Map<StepId, number>(
    stepIds.map((stepId, index) => [stepId, index]),
  );
  const neighbors = new Map<StepId, Set<StepId>>(
    stepIds.map((stepId) => [stepId, new Set<StepId>()]),
  );

  for (const { transition } of graph.validTransitions) {
    addNeighbor(neighbors, transition.sourceStepId, transition.targetStepId);
    addNeighbor(neighbors, transition.targetStepId, transition.sourceStepId);
  }

  const visited = new Set<StepId>();
  const components: StepId[][] = [];

  for (const stepId of stepIds) {
    if (visited.has(stepId)) continue;

    const component: StepId[] = [];
    const queue: StepId[] = [stepId];
    let cursor = 0;
    visited.add(stepId);

    while (cursor < queue.length) {
      const currentStepId = queue[cursor];
      cursor += 1;
      if (currentStepId === undefined) continue;

      component.push(currentStepId);
      for (const neighborStepId of neighbors.get(currentStepId) ?? []) {
        if (visited.has(neighborStepId)) continue;
        visited.add(neighborStepId);
        queue.push(neighborStepId);
      }
    }

    component.sort(
      (left, right) =>
        (canonicalIndexByStepId.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (canonicalIndexByStepId.get(right) ?? Number.MAX_SAFE_INTEGER),
    );
    components.push(component);
  }

  return components;
};
