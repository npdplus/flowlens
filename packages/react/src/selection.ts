import type { FlowLensSemanticSelection, FlowLensStepNode, FlowLensTransitionEdge } from './types';

export function selectionFromStepNode(node: FlowLensStepNode): FlowLensSemanticSelection {
  return { kind: 'step', id: node.data.stepId };
}

export function selectionFromTransitionEdge(
  edge: FlowLensTransitionEdge,
): FlowLensSemanticSelection | null {
  const transitionId = edge.data?.transitionId;
  return transitionId === undefined ? null : { kind: 'transition', id: transitionId };
}
