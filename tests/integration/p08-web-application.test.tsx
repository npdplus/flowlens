import { describe, expect, it } from 'vitest';
import {
  layoutWorkflow,
  mapWorkflowToRenderer,
  selectionFromStepNode,
  selectionFromTransitionEdge,
} from '@flowlens/react';

import { readWorkflowFile } from '../../apps/web/src/app-utils';
import { resolveSemanticSelection } from '../../apps/web/src/Inspector';
import { processWorkflowText } from '../../apps/web/src/processing';

const yamlSource = `schemaVersion: "0.1"
name: P08 integration
steps:
  - id: start
    label: Start
    type: start
  - id: review
    label: Review <script>alert(1)</script>
    type: decision
    metadata:
      url: "javascript:alert(1)"
  - id: approved
    label: Approved
    type: end
  - id: rejected
    label: Rejected
    type: end
transitions:
  - id: approve
    source: review
    target: approved
    label: Approve
    condition: "score >= 80"
  - id: reject
    source: review
    target: rejected
    label: Reject
    condition: "<script>never()</script>"
  - id: begin
    source: start
    target: review
`;

const jsonSource = JSON.stringify({
  schemaVersion: '0.1',
  name: 'P08 integration',
  steps: [
    { id: 'start', label: 'Start', type: 'start' },
    {
      id: 'review',
      label: 'Review <script>alert(1)</script>',
      type: 'decision',
      metadata: { url: 'javascript:alert(1)' },
    },
    { id: 'approved', label: 'Approved', type: 'end' },
    { id: 'rejected', label: 'Rejected', type: 'end' },
  ],
  transitions: [
    {
      id: 'approve',
      source: 'review',
      target: 'approved',
      label: 'Approve',
      condition: 'score >= 80',
    },
    {
      id: 'reject',
      source: 'review',
      target: 'rejected',
      label: 'Reject',
      condition: '<script>never()</script>',
    },
    { id: 'begin', source: 'start', target: 'review' },
  ],
});

const requireWorkflow = (source: string, format: 'json' | 'yaml') => {
  const result = processWorkflowText(source, format);
  expect(result.stage).toBe('ready');
  if (result.diagramWorkflow === undefined) throw new Error('Expected renderable workflow.');
  return { result, workflow: result.diagramWorkflow };
};

describe('P08 real application integration chain', () => {
  it.each([['yaml', yamlSource] as const, ['json', jsonSource] as const])(
    'processes %s through Core and the real P07 layout/renderer boundary',
    async (format, source) => {
      const { result, workflow } = requireWorkflow(source, format);
      const layout = await layoutWorkflow(workflow);
      expect(layout.ok).toBe(true);
      if (!layout.ok) return;

      const model = mapWorkflowToRenderer(workflow, layout);
      expect(model.nodes).toHaveLength(4);
      expect(model.edges).toHaveLength(3);
      expect(result.analysis).toMatchObject({
        stepCount: 4,
        transitionCount: 3,
        decisionStepCount: 1,
      });

      const reviewNode = model.nodes.find((node) => node.data.stepId === 'review');
      if (reviewNode === undefined) throw new Error('Expected review renderer node.');
      const stepSelection = selectionFromStepNode(reviewNode);
      const stepInspector = resolveSemanticSelection(workflow, stepSelection);
      expect(stepInspector).toMatchObject({ kind: 'step', id: 'review' });

      const rejectEdge = model.edges.find(
        (edge) => edge.data?.condition === '<script>never()</script>',
      );
      if (rejectEdge === undefined) throw new Error('Expected reject renderer edge.');
      const transitionSelection = selectionFromTransitionEdge(rejectEdge);
      const transitionInspector = resolveSemanticSelection(workflow, transitionSelection);
      expect(transitionInspector).toMatchObject({
        kind: 'transition',
        condition: '<script>never()</script>',
      });
    },
  );

  it('routes a selected local file into the same application processing path', async () => {
    const file = await readWorkflowFile({
      name: 'local.yml',
      async text() {
        return yamlSource;
      },
    });
    expect(file.ok).toBe(true);
    if (!file.ok) return;

    const result = processWorkflowText(file.text, file.format);
    expect(result.stage).toBe('ready');
    expect(result.diagramWorkflow?.name).toBe('P08 integration');
  });

  it('clears the renderable workflow for syntax, structural, and semantic error states', () => {
    expect(processWorkflowText('{', 'json').diagramWorkflow).toBeUndefined();
    expect(
      processWorkflowText('schemaVersion: "0.1"\nname: broken', 'yaml').diagramWorkflow,
    ).toBeUndefined();
    expect(
      processWorkflowText(
        JSON.stringify({
          schemaVersion: '0.1',
          name: 'semantic error',
          steps: [{ id: 'only', label: 'Only' }],
          transitions: [{ source: 'only', target: 'missing' }],
        }),
        'json',
      ).diagramWorkflow,
    ).toBeUndefined();
  });
});
