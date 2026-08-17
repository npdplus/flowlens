import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

import type { FlowLensTransitionEdge } from './types';

const BRANCH_LABEL_CLEARANCE = 48;

/**
 * Keeps normal transition labels at React Flow's smooth-step midpoint while
 * anchoring multi-way branch labels to each target column and nudging outer
 * branches away from the shared source axis so long sibling labels remain
 * readable without changing connector geometry.
 */
export function FlowLensTransitionEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerStart,
  markerEnd,
  style,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  interactionWidth,
  data,
}: EdgeProps<FlowLensTransitionEdge>) {
  const [edgePath, defaultLabelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const branchDirection = Math.sign(targetX - sourceX);
  const labelX =
    data?.branchLabelToTarget === true
      ? targetX + branchDirection * BRANCH_LABEL_CLEARANCE
      : defaultLabelX;

  return (
    <BaseEdge
      path={edgePath}
      labelX={labelX}
      labelY={labelY}
      {...(markerStart === undefined ? {} : { markerStart })}
      {...(markerEnd === undefined ? {} : { markerEnd })}
      {...(style === undefined ? {} : { style })}
      {...(label === undefined ? {} : { label })}
      {...(labelStyle === undefined ? {} : { labelStyle })}
      {...(labelShowBg === undefined ? {} : { labelShowBg })}
      {...(labelBgStyle === undefined ? {} : { labelBgStyle })}
      {...(labelBgPadding === undefined ? {} : { labelBgPadding })}
      {...(labelBgBorderRadius === undefined ? {} : { labelBgBorderRadius })}
      {...(interactionWidth === undefined ? {} : { interactionWidth })}
    />
  );
}
