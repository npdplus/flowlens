import { buildWorkflowGraphIndex, type CanonicalWorkflow } from '@flowlens/core';
import type { XYPosition } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode } from 'elkjs/lib/elk-api';

import type { FlowLensLayoutResult } from './types';

export const FLOWLENS_NODE_WIDTH = 240;
export const FLOWLENS_NODE_HEIGHT = 112;

export const FLOWLENS_LAYOUT_OPTIONS = Object.freeze({
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.spacing.nodeNode': '48',
  'elk.layered.spacing.nodeNodeBetweenLayers': '72',
  'elk.spacing.componentComponent': '96',
  'elk.separateConnectedComponents': 'true',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
});

export interface FlowLensLayoutEngine {
  layout(graph: ElkNode): Promise<ElkNode>;
}

const defaultLayoutEngine: FlowLensLayoutEngine = new ELK();

const layoutNodeId = (index: number): string => `flowlens-layout-step-${index}`;
const layoutEdgeId = (index: number): string => `flowlens-layout-transition-${index}`;

const controlledFailure = (): FlowLensLayoutResult => ({
  ok: false,
  error: {
    kind: 'layout',
    code: 'layout-failed',
    message: 'Unable to lay out this workflow diagram.',
  },
});

/**
 * Projects canonical topology into ELK presentation state without mutating the workflow.
 * Only Core-approved traversable transitions participate in layout adjacency.
 */
export async function layoutWorkflow(
  workflow: CanonicalWorkflow,
  engine: FlowLensLayoutEngine = defaultLayoutEngine,
): Promise<FlowLensLayoutResult> {
  try {
    const graphIndex = buildWorkflowGraphIndex(workflow);
    const graph: ElkNode = {
      id: 'flowlens-layout-root',
      layoutOptions: FLOWLENS_LAYOUT_OPTIONS,
      children: workflow.steps.map((_step, index) => ({
        id: layoutNodeId(index),
        width: FLOWLENS_NODE_WIDTH,
        height: FLOWLENS_NODE_HEIGHT,
      })),
      edges: graphIndex.validTransitions.map(({ transition, index }) => {
        const source = graphIndex.stepById.get(transition.sourceStepId);
        const target = graphIndex.stepById.get(transition.targetStepId);

        if (source === undefined || target === undefined) {
          throw new Error('Core graph index returned a non-traversable transition as traversable.');
        }

        return {
          id: layoutEdgeId(index),
          sources: [layoutNodeId(source.index)],
          targets: [layoutNodeId(target.index)],
        };
      }),
    };

    const laidOut = await engine.layout(graph);
    const positions = new Map<string, XYPosition>();
    let maximumX = 0;
    let maximumY = 0;

    for (const [index, step] of workflow.steps.entries()) {
      const child = laidOut.children?.find((candidate) => candidate.id === layoutNodeId(index));
      if (
        child === undefined ||
        child.x === undefined ||
        child.y === undefined ||
        !Number.isFinite(child.x) ||
        !Number.isFinite(child.y)
      ) {
        return controlledFailure();
      }

      positions.set(step.id, { x: child.x, y: child.y });
      maximumX = Math.max(maximumX, child.x + FLOWLENS_NODE_WIDTH);
      maximumY = Math.max(maximumY, child.y + FLOWLENS_NODE_HEIGHT);
    }

    return {
      ok: true,
      positions,
      bounds: {
        width: Math.max(laidOut.width ?? 0, maximumX),
        height: Math.max(laidOut.height ?? 0, maximumY),
      },
    };
  } catch {
    return controlledFailure();
  }
}
