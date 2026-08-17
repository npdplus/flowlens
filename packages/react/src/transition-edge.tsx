import {
  BaseEdge,
  EdgeText,
  getSmoothStepPath,
  Position,
  type EdgeProps,
} from '@xyflow/react';

import type { FlowLensTransitionEdge } from './types';

export const FLOWLENS_BRANCH_LABEL_OFFSET = 72;

export function FlowLensTransitionEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  markerEnd,
  style,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  interactionWidth,
}: EdgeProps<FlowLensTransitionEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const horizontalDelta = targetX - sourceX;
  const labelOffsetX =
    Math.abs(horizontalDelta) < 1 ? 0 : Math.sign(horizontalDelta) * FLOWLENS_BRANCH_LABEL_OFFSET;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={interactionWidth}
      />
      {label === undefined || label === null ? null : (
        <EdgeText
          x={labelX + labelOffsetX}
          y={labelY}
          label={label}
          labelStyle={labelStyle}
          labelShowBg={labelShowBg}
          labelBgStyle={labelBgStyle}
          labelBgPadding={labelBgPadding}
          labelBgBorderRadius={labelBgBorderRadius}
        />
      )}
    </>
  );
}
