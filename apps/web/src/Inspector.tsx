import {
  buildWorkflowGraphIndex,
  type CanonicalTransition,
  type CanonicalWorkflow,
} from '@flowlens/core';
import type { FlowLensSemanticSelection } from '@flowlens/react';

export type InspectorModel =
  | {
      readonly kind: 'step';
      readonly id: string;
      readonly label: string;
      readonly type: string;
      readonly status: string;
      readonly description?: string;
      readonly incoming: readonly CanonicalTransition[];
      readonly outgoing: readonly CanonicalTransition[];
      readonly metadata: CanonicalWorkflow['steps'][number]['metadata'];
    }
  | {
      readonly kind: 'transition';
      readonly source: string;
      readonly target: string;
      readonly sourceDefinedId?: string;
      readonly label?: string;
      readonly condition?: string;
      readonly metadata: CanonicalTransition['metadata'];
    };

export const resolveSemanticSelection = (
  workflow: CanonicalWorkflow,
  selection: FlowLensSemanticSelection | null,
): InspectorModel | null => {
  if (selection === null) return null;

  if (selection.kind === 'step') {
    const graph = buildWorkflowGraphIndex(workflow);
    const indexedStep = graph.stepById.get(selection.id);
    if (indexedStep === undefined) return null;
    const step = indexedStep.step;
    return {
      kind: 'step',
      id: step.id,
      label: step.label,
      type: step.type,
      status: step.status ?? 'not set',
      ...(step.description === undefined ? {} : { description: step.description }),
      incoming: (graph.incomingTransitionsByStepId.get(step.id) ?? []).map(
        ({ transition }) => transition,
      ),
      outgoing: (graph.outgoingTransitionsByStepId.get(step.id) ?? []).map(
        ({ transition }) => transition,
      ),
      metadata: step.metadata,
    };
  }

  const transition = workflow.transitions.find(
    (candidate) => candidate.internalId === selection.id,
  );
  if (transition === undefined) return null;
  return {
    kind: 'transition',
    source: transition.sourceStepId,
    target: transition.targetStepId,
    ...(transition.sourceDefinedId === undefined
      ? {}
      : { sourceDefinedId: transition.sourceDefinedId }),
    ...(transition.label === undefined ? {} : { label: transition.label }),
    ...(transition.condition === undefined ? {} : { condition: transition.condition }),
    metadata: transition.metadata,
  };
};

const MetadataView = ({ value }: { readonly value: unknown }) => {
  const text = JSON.stringify(value, null, 2);
  if (text === undefined || text === '{}') return <span className="muted">None</span>;
  return <pre className="metadata-view">{text}</pre>;
};

const TransitionList = ({
  title,
  transitions,
}: {
  readonly title: string;
  readonly transitions: readonly CanonicalTransition[];
}) => (
  <div className="inspector-transition-group">
    <h3>{title}</h3>
    {transitions.length === 0 ? (
      <p className="muted">None</p>
    ) : (
      <ul className="transition-list">
        {transitions.map((transition) => (
          <li key={transition.internalId}>
            <strong>
              {transition.sourceStepId} → {transition.targetStepId}
            </strong>
            {transition.label === undefined ? null : <span>{transition.label}</span>}
            {transition.condition === undefined ? null : (
              <code className="condition-text">{transition.condition}</code>
            )}
          </li>
        ))}
      </ul>
    )}
  </div>
);

export function Inspector({ model }: { readonly model: InspectorModel | null }) {
  if (model === null) {
    return (
      <section className="panel inspector-panel" aria-labelledby="inspector-heading">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">Semantic selection</p>
            <h2 id="inspector-heading">Inspector</h2>
          </div>
        </div>
        <p className="empty-copy">
          Select a workflow step or transition to inspect its canonical details.
        </p>
      </section>
    );
  }

  if (model.kind === 'transition') {
    return (
      <section className="panel inspector-panel" aria-labelledby="inspector-heading">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">Transition</p>
            <h2 id="inspector-heading">Inspector</h2>
          </div>
        </div>
        <dl className="inspector-grid">
          <div>
            <dt>Source</dt>
            <dd>{model.source}</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>{model.target}</dd>
          </div>
          <div>
            <dt>Source ID</dt>
            <dd>{model.sourceDefinedId ?? 'Not defined'}</dd>
          </div>
          <div>
            <dt>Label</dt>
            <dd>{model.label ?? 'Not set'}</dd>
          </div>
          <div className="wide">
            <dt>Condition</dt>
            <dd>
              <code className="condition-text">{model.condition ?? 'Not set'}</code>
            </dd>
          </div>
          <div className="wide">
            <dt>Metadata</dt>
            <dd>
              <MetadataView value={model.metadata} />
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section className="panel inspector-panel" aria-labelledby="inspector-heading">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Step</p>
          <h2 id="inspector-heading">Inspector</h2>
        </div>
      </div>
      <dl className="inspector-grid">
        <div>
          <dt>ID</dt>
          <dd>{model.id}</dd>
        </div>
        <div>
          <dt>Label</dt>
          <dd>{model.label}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{model.type}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{model.status}</dd>
        </div>
        <div className="wide">
          <dt>Description</dt>
          <dd>{model.description ?? 'Not set'}</dd>
        </div>
        <div className="wide">
          <dt>Metadata</dt>
          <dd>
            <MetadataView value={model.metadata} />
          </dd>
        </div>
      </dl>
      <TransitionList title="Incoming transitions" transitions={model.incoming} />
      <TransitionList title="Outgoing transitions" transitions={model.outgoing} />
    </section>
  );
}
