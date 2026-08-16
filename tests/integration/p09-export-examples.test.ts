import { describe, expect, it } from 'vitest';
import { layoutWorkflow, mapWorkflowToRenderer } from '@flowlens/react';

import { FLOWLENS_EXAMPLES } from '../../apps/web/src/examples';
import { resolveSemanticSelection } from '../../apps/web/src/Inspector';
import { processWorkflowText } from '../../apps/web/src/processing';

const requireRenderable = (source: string) => {
  const result = processWorkflowText(source, 'yaml');
  expect(result.stage).toBe('ready');
  expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
  if (result.diagramWorkflow === undefined) {
    throw new Error('Expected renderable example workflow.');
  }
  return { result, workflow: result.diagramWorkflow };
};

describe('P09 official examples and renderer export source', () => {
  it('publishes the five required native YAML example categories', () => {
    expect(FLOWLENS_EXAMPLES.map((example) => example.label)).toEqual([
      'Simple Sequential Workflow',
      'Purchase Approval',
      'CI/CD Deployment',
      'AI Agent Workflow',
      'Incident Response',
    ]);
    expect(FLOWLENS_EXAMPLES.every((example) => example.format === 'yaml')).toBe(true);
    expect(FLOWLENS_EXAMPLES.every((example) => example.source.startsWith('schemaVersion:'))).toBe(
      true,
    );
  });

  it.each(FLOWLENS_EXAMPLES.map((example) => [example.label, example.source] as const))(
    'processes %s through the production Core → P07 layout → renderer pipeline',
    async (_label, source) => {
      const { result, workflow } = requireRenderable(source);
      const layout = await layoutWorkflow(workflow);
      expect(layout.ok).toBe(true);
      if (!layout.ok) return;
      const model = mapWorkflowToRenderer(workflow, layout);

      expect(model.nodes).toHaveLength(workflow.steps.length);
      expect(model.edges).toHaveLength(workflow.transitions.length);
      expect(model.bounds.width).toBeGreaterThan(0);
      expect(model.bounds.height).toBeGreaterThan(0);
      expect(result.analysis?.stepCount).toBe(workflow.steps.length);
      expect(JSON.stringify(workflow)).not.toMatch(/customer|credential|password|api[_-]?key/iu);
    },
  );

  it('keeps example selection compatible with semantic Inspector selection', async () => {
    const purchase = FLOWLENS_EXAMPLES.find((example) => example.id === 'purchase-approval');
    if (purchase === undefined) throw new Error('Purchase Approval example missing.');
    const { workflow } = requireRenderable(purchase.source);
    const layout = await layoutWorkflow(workflow);
    expect(layout.ok).toBe(true);
    if (!layout.ok) return;
    const model = mapWorkflowToRenderer(workflow, layout);
    const manager = model.nodes.find((node) => node.data.stepId === 'manager');
    if (manager === undefined) throw new Error('Expected manager step.');

    expect(
      resolveSemanticSelection(workflow, { kind: 'step', id: manager.data.stepId }),
    ).toMatchObject({
      kind: 'step',
      id: 'manager',
      label: 'Manager Approval',
    });
  });

  it('keeps malicious-looking metadata out of the renderer/export source while preserving visible text as data', async () => {
    const malicious = `schemaVersion: "0.1"
name: Export security
steps:
  - id: start
    label: "<script>alert(1)</script>"
    type: start
    metadata:
      hidden: hidden-private-value
      url: "javascript:alert(1)"
  - id: done
    label: Done
    type: end
transitions:
  - id: finish
    source: start
    target: done
    label: "<b>Finish</b>"
    condition: "javascript:neverExecute()"
    metadata:
      remote: "https://example.invalid/private"
`;
    const { workflow } = requireRenderable(malicious);
    const layout = await layoutWorkflow(workflow);
    expect(layout.ok).toBe(true);
    if (!layout.ok) return;
    const model = mapWorkflowToRenderer(workflow, layout);
    const serialized = JSON.stringify(model);

    expect(serialized).toContain('<script>alert(1)</script>');
    expect(serialized).toContain('javascript:neverExecute()');
    expect(serialized).not.toContain('hidden-private-value');
    expect(serialized).not.toContain('https://example.invalid/private');
  });
});
