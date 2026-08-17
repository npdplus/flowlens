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
