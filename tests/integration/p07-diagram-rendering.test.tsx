import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CanonicalWorkflow } from '@flowlens/core';
import {
  FlowLensDiagramSurface,
  layoutWorkflow,
  mapWorkflowToRenderer,
  selectionFromStepNode,
  selectionFromTransitionEdge,
} from '@flowlens/react';

const workflow: CanonicalWorkflow = {
  schemaVersion: '0.1',
  name: 'P07 integration',
  steps: [
    { id: 'start', label: '<Start>', type: 'start', status: 'success', metadata: {} },
    { id: 'decision', label: 'Review', type: 'decision', status: 'active', metadata: {} },
    { id: 'approve', label: 'Approve', type: 'end', status: 'success', metadata: {} },
    { id: 'retry', label: 'Retry', type: 'action', status: 'warning', metadata: {} },
    { id: 'isolated', label: 'Isolated', type: 'action', metadata: {} },
  ],
  transitions: [
    {
      internalId: 't:start:decision',
      sourceStepId: 'start',
      targetStepId: 'decision',
      metadata: {},
    },
    {
      internalId: 't:decision:approve',
      sourceStepId: 'decision',
      targetStepId: 'approve',
      label: 'Yes',
      condition: 'amount < 1000',
      metadata: {},
    },
    {
      internalId: 't:decision:retry',
      sourceStepId: 'decision',
      targetStepId: 'retry',
      label: 'No',
      condition: '<script>never()</script>',
      metadata: {},
    },
    {
      internalId: 't:retry:decision',
      sourceStepId: 'retry',
      targetStepId: 'decision',
      metadata: {},
    },
    {
      internalId: 't:retry:retry',
      sourceStepId: 'retry',
      targetStepId: 'retry',
      label: 'Again',
      metadata: {},
    },
  ],
  metadata: {},
};

describe('P07 canonical workflow → ELK → React Flow integration', () => {
  it('builds a complete renderer model for branches, cycles, self-loops and disconnected nodes', async () => {
    const layout = await layoutWorkflow(workflow);
    expect(layout.ok).toBe(true);
    if (!layout.ok) return;

    const model = mapWorkflowToRenderer(workflow, layout);

    expect(model.nodes).toHaveLength(5);
    expect(model.edges).toHaveLength(5);
    expect(model.nodes.map((node) => node.data.stepId)).toContain('isolated');
    expect(model.edges.find((edge) => edge.data?.transitionId === 't:retry:retry')).toMatchObject({
      source: 'flowlens-step-3',
      target: 'flowlens-step-3',
    });
  });

  it('renders the actual React Flow surface as safe static markup', async () => {
    const layout = await layoutWorkflow(workflow);
    if (!layout.ok) throw new Error(layout.error.message);
    const model = mapWorkflowToRenderer(workflow, layout);

    const markup = renderToStaticMarkup(
      <FlowLensDiagramSurface model={model} theme="dark" initialFitView={false} />,
    );

    expect(markup).toContain('aria-label="Workflow diagram"');
    expect(markup).toContain('data-flowlens-theme="dark"');
    expect(markup).toContain('&lt;Start&gt;');
    expect(markup).not.toContain('<script>never()</script>');
    expect(markup).toContain('Condition: &lt;script&gt;never()&lt;/script&gt;');
  });

  it('returns semantic identities for step and transition selection', async () => {
    const layout = await layoutWorkflow(workflow);
    if (!layout.ok) throw new Error(layout.error.message);
    const model = mapWorkflowToRenderer(workflow, layout);
    const stepNode = model.nodes.find((node) => node.data.stepId === 'decision');
    const edge = model.edges.find((item) => item.data?.transitionId === 't:decision:approve');

    expect(stepNode === undefined ? null : selectionFromStepNode(stepNode)).toEqual({
      kind: 'step',
      id: 'decision',
    });
    expect(edge === undefined ? null : selectionFromTransitionEdge(edge)).toEqual({
      kind: 'transition',
      id: 't:decision:approve',
    });
  });

  it('does not mutate canonical input across layout and renderer mapping', async () => {
    const input = structuredClone(workflow);
    const before = structuredClone(input);
    const layout = await layoutWorkflow(input);
    if (!layout.ok) throw new Error(layout.error.message);

    mapWorkflowToRenderer(input, layout);

    expect(input).toEqual(before);
  });
});
