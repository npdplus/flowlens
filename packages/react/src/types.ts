import type {
  CanonicalStepStatus,
  CanonicalStepType,
  StepId,
  TransitionInternalId,
} from '@flowlens/core';
import type { Edge, FitViewOptions, Node, XYPosition } from '@xyflow/react';

import type { FlowLensDiagramExportResult } from './export';

export type FlowLensTheme = 'light' | 'dark';

export type FlowLensSemanticSelection =
  | { readonly kind: 'step'; readonly id: StepId }
  | { readonly kind: 'transition'; readonly id: TransitionInternalId };

export interface FlowLensStepNodeData extends Record<string, unknown> {
  readonly stepId: StepId;
  readonly label: string;
  readonly stepType: CanonicalStepType;
  readonly description?: string;
  readonly status?: CanonicalStepStatus;
  readonly statusLabel: string;
  readonly statusSymbol: string;
}

export interface FlowLensTransitionEdgeData extends Record<string, unknown> {
  readonly transitionId: TransitionInternalId;
  readonly sourceStepId: StepId;
  readonly targetStepId: StepId;
  readonly label?: string;
  readonly condition?: string;
  readonly branchLabelToTarget: boolean;
}

export type FlowLensStepNode = Node<FlowLensStepNodeData, 'flowlens-step'>;
export type FlowLensTransitionEdge = Edge<FlowLensTransitionEdgeData, 'flowlens-transition'>;

export interface FlowLensDiagramBounds {
  readonly width: number;
  readonly height: number;
}

export interface FlowLensLayoutSuccess {
  readonly ok: true;
  readonly positions: ReadonlyMap<StepId, XYPosition>;
  readonly bounds: FlowLensDiagramBounds;
}

export interface FlowLensLayoutFailure {
  readonly ok: false;
  readonly error: FlowLensDiagramError;
}

export interface FlowLensDiagramError {
  readonly kind: 'layout' | 'renderer';
  readonly code: 'layout-failed' | 'renderer-failed';
  readonly message: string;
}

export type FlowLensLayoutResult = FlowLensLayoutSuccess | FlowLensLayoutFailure;

export interface FlowLensRendererModel {
  readonly nodes: readonly FlowLensStepNode[];
  readonly edges: readonly FlowLensTransitionEdge[];
  readonly bounds: FlowLensDiagramBounds;
}

export interface FlowLensDiagramHandle {
  fitView(options?: FitViewOptions<FlowLensStepNode>): Promise<boolean>;
  zoomIn(): Promise<boolean>;
  zoomOut(): Promise<boolean>;
  exportSvg(): Promise<FlowLensDiagramExportResult>;
  exportPng(): Promise<FlowLensDiagramExportResult>;
}
