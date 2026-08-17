import {
  Component,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import type { CanonicalWorkflow } from '@flowlens/core';
import {
  BaseEdge,
  Controls,
  EdgeText,
  getSmoothStepPath,
  Position,
  ReactFlow,
  type EdgeProps,
  type EdgeTypes,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';

import { exportDiagramPng, exportDiagramSvg } from './export';
import { layoutWorkflow } from './layout';
import { mapWorkflowToRenderer } from './mapping';
import { selectionFromStepNode, selectionFromTransitionEdge } from './selection';
import { FlowLensStepNodeComponent } from './step-node';
import type {
  FlowLensDiagramError,
  FlowLensDiagramHandle,
  FlowLensRendererModel,
  FlowLensSemanticSelection,
  FlowLensStepNode,
  FlowLensTheme,
  FlowLensTransitionEdge,
} from './types';

export const FLOWLENS_READ_ONLY_INTERACTION = Object.freeze({
  nodesDraggable: false,
  nodesConnectable: false,
  edgesReconnectable: false,
  deleteKeyCode: null,
  elementsSelectable: true,
  panOnDrag: true,
  zoomOnScroll: true,
  zoomOnPinch: true,
  zoomOnDoubleClick: true,
});

export const FLOWLENS_ARIA_LABEL_CONFIG = Object.freeze({
  'node.a11yDescription.default': 'Press enter or space to select this workflow step.',
  'node.a11yDescription.keyboardDisabled': 'Press enter or space to select this workflow step.',
  'edge.a11yDescription.default': 'Press enter or space to select this workflow transition.',
  'controls.ariaLabel': 'FlowLens diagram controls',
  'controls.zoomIn.ariaLabel': 'Zoom in workflow diagram',
  'controls.zoomOut.ariaLabel': 'Zoom out workflow diagram',
  'controls.fitView.ariaLabel': 'Fit workflow diagram to view',
  'controls.interactive.ariaLabel': 'Toggle workflow diagram interactivity',
});

const NODE_TYPES = Object.freeze({
  'flowlens-step': FlowLensStepNodeComponent,
}) satisfies NodeTypes;

const FLOWLENS_BRANCH_LABEL_OFFSET = 72;

function FlowLensTransitionEdgeComponent({
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
        {...(markerEnd === undefined ? {} : { markerEnd })}
        {...(style === undefined ? {} : { style })}
        {...(interactionWidth === undefined ? {} : { interactionWidth })}
      />
      {label === undefined || label === null ? null : (
        <EdgeText
          x={labelX + labelOffsetX}
          y={labelY}
          label={label}
          {...(labelStyle === undefined ? {} : { labelStyle })}
          {...(labelShowBg === undefined ? {} : { labelShowBg })}
          {...(labelBgStyle === undefined ? {} : { labelBgStyle })}
          {...(labelBgPadding === undefined ? {} : { labelBgPadding })}
          {...(labelBgBorderRadius === undefined ? {} : { labelBgBorderRadius })}
        />
      )}
    </>
  );
}

const EDGE_TYPES = Object.freeze({
  'flowlens-transition': FlowLensTransitionEdgeComponent,
}) satisfies EdgeTypes;

const rendererFailure = (): FlowLensDiagramError => ({
  kind: 'renderer',
  code: 'renderer-failed',
  message: 'Unable to render this workflow diagram.',
});

interface DiagramErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onError?: (error: FlowLensDiagramError) => void;
}

interface DiagramErrorBoundaryState {
  readonly failed: boolean;
}

class DiagramErrorBoundary extends Component<DiagramErrorBoundaryProps, DiagramErrorBoundaryState> {
  state: DiagramErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): DiagramErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onError?.(rendererFailure());
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flowlens-diagram__error" role="alert">
          Unable to render this workflow diagram.
        </div>
      );
    }
    return this.props.children;
  }
}

export interface FlowLensDiagramSurfaceProps {
  readonly model: FlowLensRendererModel;
  readonly theme?: FlowLensTheme;
  readonly initialFitView?: boolean;
  readonly onSelectionChange?: (selection: FlowLensSemanticSelection | null) => void;
  readonly onInit?: (instance: ReactFlowInstance<FlowLensStepNode, FlowLensTransitionEdge>) => void;
  readonly surfaceRef?: Ref<HTMLDivElement>;
}

export function FlowLensDiagramSurface({
  model,
  theme = 'light',
  initialFitView = true,
  onSelectionChange,
  onInit,
  surfaceRef,
}: FlowLensDiagramSurfaceProps) {
  const nodes = model.nodes.slice();
  const edges = model.edges.slice();

  return (
    <div
      ref={surfaceRef}
      className="flowlens-diagram__surface"
      data-flowlens-theme={theme}
      role="region"
      aria-label="Workflow diagram"
    >
      <ReactFlow<FlowLensStepNode, FlowLensTransitionEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        colorMode={theme}
        fitView={initialFitView}
        fitViewOptions={{ padding: 0.16, minZoom: 0.2, maxZoom: 1.5 }}
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={FLOWLENS_READ_ONLY_INTERACTION.nodesDraggable}
        nodesConnectable={FLOWLENS_READ_ONLY_INTERACTION.nodesConnectable}
        edgesReconnectable={FLOWLENS_READ_ONLY_INTERACTION.edgesReconnectable}
        deleteKeyCode={FLOWLENS_READ_ONLY_INTERACTION.deleteKeyCode}
        elementsSelectable={FLOWLENS_READ_ONLY_INTERACTION.elementsSelectable}
        panOnDrag={FLOWLENS_READ_ONLY_INTERACTION.panOnDrag}
        zoomOnScroll={FLOWLENS_READ_ONLY_INTERACTION.zoomOnScroll}
        zoomOnPinch={FLOWLENS_READ_ONLY_INTERACTION.zoomOnPinch}
        zoomOnDoubleClick={FLOWLENS_READ_ONLY_INTERACTION.zoomOnDoubleClick}
        ariaLabelConfig={FLOWLENS_ARIA_LABEL_CONFIG}
        {...(onInit === undefined ? {} : { onInit })}
        onNodesChange={(changes) => {
          for (const change of changes) {
            if (change.type === 'select' && change.selected) {
              const selectedNode = nodes.find((node) => node.id === change.id);
              if (selectedNode !== undefined) {
                onSelectionChange?.(selectionFromStepNode(selectedNode));
              }
              return;
            }
          }

          if (changes.some((change) => change.type === 'select')) {
            onSelectionChange?.(null);
          }
        }}
        onEdgesChange={(changes) => {
          for (const change of changes) {
            if (change.type === 'select' && change.selected) {
              const selectedEdge = edges.find((edge) => edge.id === change.id);
              if (selectedEdge !== undefined) {
                const selection = selectionFromTransitionEdge(selectedEdge);
                if (selection !== null) {
                  onSelectionChange?.(selection);
                }
              }
              return;
            }
          }

          if (changes.some((change) => change.type === 'select')) {
            onSelectionChange?.(null);
          }
        }}
        onNodeClick={(_event, node) => {
          onSelectionChange?.(selectionFromStepNode(node));
        }}
        onEdgeClick={(_event, edge) => {
          const selection = selectionFromTransitionEdge(edge);
          if (selection !== null) {
            onSelectionChange?.(selection);
          }
        }}
        onPaneClick={() => onSelectionChange?.(null)}
        defaultEdgeOptions={{ deletable: false, reconnectable: false }}
        nodesFocusable
        edgesFocusable
      >
        <Controls showInteractive={false} aria-label="FlowLens diagram controls" />
      </ReactFlow>
    </div>
  );
}

export interface FlowLensDiagramProps {
  readonly workflow: CanonicalWorkflow;
  readonly theme?: FlowLensTheme;
  readonly className?: string;
  readonly initialFitView?: boolean;
  readonly onSelectionChange?: (selection: FlowLensSemanticSelection | null) => void;
  readonly onError?: (error: FlowLensDiagramError) => void;
}

type DiagramState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly model: FlowLensRendererModel; readonly epoch: number }
  | { readonly status: 'error'; readonly error: FlowLensDiagramError };

export const FlowLensDiagram = forwardRef<FlowLensDiagramHandle, FlowLensDiagramProps>(
  function FlowLensDiagram(
    { workflow, theme = 'light', className, initialFitView = true, onSelectionChange, onError },
    ref,
  ) {
    const instanceRef = useRef<ReactFlowInstance<FlowLensStepNode, FlowLensTransitionEdge> | null>(
      null,
    );
    const surfaceRef = useRef<HTMLDivElement | null>(null);
    const epochRef = useRef(0);
    const [state, setState] = useState<DiagramState>({ status: 'loading' });

    useImperativeHandle(ref, () => {
      const model = state.status === 'ready' ? state.model : null;
      return {
        fitView: (options) => instanceRef.current?.fitView(options) ?? Promise.resolve(false),
        zoomIn: () => instanceRef.current?.zoomIn() ?? Promise.resolve(false),
        zoomOut: () => instanceRef.current?.zoomOut() ?? Promise.resolve(false),
        exportSvg: () => exportDiagramSvg(surfaceRef.current, model, theme),
        exportPng: () => exportDiagramPng(surfaceRef.current, model, theme),
      };
    }, [state, theme]);

    useEffect(() => {
      let cancelled = false;
      instanceRef.current = null;
      setState({ status: 'loading' });

      void layoutWorkflow(workflow).then((layout) => {
        if (cancelled) {
          return;
        }
        if (!layout.ok) {
          onError?.(layout.error);
          setState({ status: 'error', error: layout.error });
          return;
        }

        try {
          const model = mapWorkflowToRenderer(workflow, layout);
          epochRef.current += 1;
          setState({ status: 'ready', model, epoch: epochRef.current });
        } catch {
          const error = rendererFailure();
          onError?.(error);
          setState({ status: 'error', error });
        }
      });

      return () => {
        cancelled = true;
      };
    }, [workflow, onError]);

    const rootClassName =
      className === undefined ? 'flowlens-diagram' : `flowlens-diagram ${className}`;

    if (state.status === 'loading') {
      return (
        <div className={rootClassName} data-flowlens-theme={theme} aria-busy="true">
          <div className="flowlens-diagram__loading">Laying out workflow…</div>
        </div>
      );
    }

    if (state.status === 'error') {
      return (
        <div className={rootClassName} data-flowlens-theme={theme}>
          <div className="flowlens-diagram__error" role="alert">
            {state.error.message}
          </div>
        </div>
      );
    }

    return (
      <div className={rootClassName} data-flowlens-theme={theme}>
        <DiagramErrorBoundary key={state.epoch} {...(onError === undefined ? {} : { onError })}>
          <FlowLensDiagramSurface
            model={state.model}
            theme={theme}
            initialFitView={initialFitView}
            {...(onSelectionChange === undefined ? {} : { onSelectionChange })}
            onInit={(instance) => {
              instanceRef.current = instance;
            }}
            surfaceRef={surfaceRef}
          />
        </DiagramErrorBoundary>
      </div>
    );
  },
);
