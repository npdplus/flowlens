import './styles.css';

import { FLOWLENS_CORE_FOUNDATION } from '@flowlens/core';

export function FlowLensFoundationBadge() {
  return (
    <span data-flowlens-foundation={FLOWLENS_CORE_FOUNDATION.phase}>
      Core → React boundary ready
    </span>
  );
}

export {
  FLOWLENS_ARIA_LABEL_CONFIG,
  FLOWLENS_READ_ONLY_INTERACTION,
  FlowLensDiagram,
  FlowLensDiagramSurface,
  type FlowLensDiagramProps,
  type FlowLensDiagramSurfaceProps,
} from './diagram';
export {
  FLOWLENS_EXPORT_PADDING,
  FLOWLENS_PNG_MAX_DIMENSION,
  FLOWLENS_PNG_PREFERRED_SCALE,
  exportDiagramPng,
  exportDiagramSvg,
  getPngExportDimensions,
  type FlowLensDiagramExportArtifact,
  type FlowLensDiagramExportError,
  type FlowLensDiagramExportResult,
} from './export';
export {
  FLOWLENS_LAYOUT_OPTIONS,
  FLOWLENS_NODE_HEIGHT,
  FLOWLENS_NODE_WIDTH,
  layoutWorkflow,
  type FlowLensLayoutEngine,
} from './layout';
export {
  formatTransitionLabel,
  getStatusPresentation,
  getStepTypeLabel,
  mapWorkflowToRenderer,
} from './mapping';
export { selectionFromStepNode, selectionFromTransitionEdge } from './selection';
export type {
  FlowLensDiagramBounds,
  FlowLensDiagramError,
  FlowLensDiagramHandle,
  FlowLensLayoutFailure,
  FlowLensLayoutResult,
  FlowLensLayoutSuccess,
  FlowLensRendererModel,
  FlowLensSemanticSelection,
  FlowLensStepNode,
  FlowLensStepNodeData,
  FlowLensTheme,
  FlowLensTransitionEdge,
  FlowLensTransitionEdgeData,
} from './types';
