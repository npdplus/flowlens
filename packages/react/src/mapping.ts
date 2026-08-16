import {
  buildWorkflowGraphIndex,
  type CanonicalStepStatus,
  type CanonicalStepType,
  type CanonicalTransition,
  type CanonicalWorkflow,
} from '@flowlens/core';
import { MarkerType, Position } from '@xyflow/react';

import { FLOWLENS_NODE_HEIGHT, FLOWLENS_NODE_WIDTH } from './layout';
import type { FlowLensLayoutSuccess, FlowLensRendererModel, FlowLensStepNodeData } from './types';

const STEP_TYPE_LABELS: Readonly<Record<CanonicalStepType, string>> = Object.freeze({
  start: 'Start',
  action: 'Action',
  decision: 'Decision',
  end: 'End',
});

const STATUS_PRESENTATION: Readonly<
  Record<CanonicalStepStatus, { readonly label: string; readonly symbol: string }>
> = Object.freeze({
  pending: { label: 'Pending', symbol: '○' },
  active: { label: 'Active', symbol: '●' },
  success: { label: 'Success', symbol: '✓' },
  warning: { label: 'Warning', symbol: '!' },
  failed: { label: 'Failed', symbol: '×' },
  skipped: { label: 'Skipped', symbol: '–' },
});

const NEUTRAL_STATUS = Object.freeze({ label: 'No status', symbol: '—' });

export const rendererNodeId = (index: number): string => `flowlens-step-${index}`;
export const rendererEdgeId = (index: number): string => `flowlens-transition-${index}`;

const missingEndpointId = (kind: 'source' | 'target', index: number): string =>
  `flowlens-missing-${kind}-${index}`;

export function getStepTypeLabel(type: CanonicalStepType): string {
  return STEP_TYPE_LABELS[type];
}

export function getStatusPresentation(status: CanonicalStepStatus | undefined): {
  readonly label: string;
  readonly symbol: string;
} {
  return status === undefined ? NEUTRAL_STATUS : STATUS_PRESENTATION[status];
}

export function formatTransitionLabel(transition: CanonicalTransition): string | undefined {
  const parts: string[] = [];
  if (transition.label !== undefined) {
    parts.push(transition.label);
  }
  if (transition.condition !== undefined) {
    parts.push(`Condition: ${transition.condition}`);
  }
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/** Maps canonical data plus derived layout into React Flow presentation objects. */
export function mapWorkflowToRenderer(
  workflow: CanonicalWorkflow,
  layout: FlowLensLayoutSuccess,
): FlowLensRendererModel {
  const graphIndex = buildWorkflowGraphIndex(workflow);

  const nodes = workflow.steps.map((step, index) => {
    const position = layout.positions.get(step.id);
    if (position === undefined) {
      throw new Error('Layout result is missing a canonical step position.');
    }

    const status = getStatusPresentation(step.status);
    const data: FlowLensStepNodeData = {
      stepId: step.id,
      label: step.label,
      stepType: step.type,
      statusLabel: status.label,
      statusSymbol: status.symbol,
      ...(step.description === undefined ? {} : { description: step.description }),
      ...(step.status === undefined ? {} : { status: step.status }),
    };

    return {
      id: rendererNodeId(index),
      type: 'flowlens-step' as const,
      position,
      width: FLOWLENS_NODE_WIDTH,
      height: FLOWLENS_NODE_HEIGHT,
      handles: [
        {
          id: 'target',
          type: 'target' as const,
          position: Position.Top,
          x: FLOWLENS_NODE_WIDTH / 2,
          y: 0,
          width: 1,
          height: 1,
        },
        {
          id: 'source',
          type: 'source' as const,
          position: Position.Bottom,
          x: FLOWLENS_NODE_WIDTH / 2,
          y: FLOWLENS_NODE_HEIGHT,
          width: 1,
          height: 1,
        },
      ],
      data,
      draggable: false,
      connectable: false,
      deletable: false,
      selectable: true,
      focusable: true,
      ariaLabel: `${step.label}. ${getStepTypeLabel(step.type)} step. Status: ${status.label}.`,
      className: `flowlens-step flowlens-step--${step.type} flowlens-step--status-${step.status ?? 'neutral'}`,
    };
  });

  const edges = workflow.transitions.map((transition, index) => {
    const sourceIndex = graphIndex.stepById.get(transition.sourceStepId)?.index;
    const targetIndex = graphIndex.stepById.get(transition.targetStepId)?.index;
    const visibleLabel = formatTransitionLabel(transition);

    return {
      id: rendererEdgeId(index),
      source:
        sourceIndex === undefined
          ? missingEndpointId('source', index)
          : rendererNodeId(sourceIndex),
      target:
        targetIndex === undefined
          ? missingEndpointId('target', index)
          : rendererNodeId(targetIndex),
      type: 'smoothstep',
      data: {
        transitionId: transition.internalId,
        sourceStepId: transition.sourceStepId,
        targetStepId: transition.targetStepId,
        ...(transition.label === undefined ? {} : { label: transition.label }),
        ...(transition.condition === undefined ? {} : { condition: transition.condition }),
      },
      ...(visibleLabel === undefined ? {} : { label: visibleLabel }),
      markerEnd: { type: MarkerType.ArrowClosed },
      selectable: true,
      deletable: false,
      reconnectable: false,
      focusable: true,
      ariaLabel: `Transition from ${transition.sourceStepId} to ${transition.targetStepId}${visibleLabel === undefined ? '' : `: ${visibleLabel}`}`,
      className: 'flowlens-transition',
    };
  });

  return { nodes, edges, bounds: layout.bounds };
}
