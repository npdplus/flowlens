import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

import type { FlowLensTransitionEdge } from './types';

/**
 * Keeps normal transition labels at React Flow's smooth-step midpoint while
 * anchoring multi-way branch labels to each target column so sibling labels
 * do not collapse onto the same midpoint.
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
  const labelX = data?.branchLabelToTarget === true ? targetX : defaultLabelX;

  return (
    <BaseEdge
      path={edgePath}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={style}
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      interactionWidth={interactionWidth}
    />
  );
}
