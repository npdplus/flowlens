import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Inspector, resolveSemanticSelection } from './Inspector';
import { processWorkflowText } from './processing';

const source = JSON.stringify({
  schemaVersion: '0.1',
  name: 'Inspector fixture',
  steps: [
    { id: 'start', label: 'Start', type: 'start' },
    {
      id: 'review',
      label: '<script>Review</script>',
      description: '<img src=x onerror=alert(1)>',
      metadata: { href: 'javascript:alert(1)' },
    },
    { id: 'done', label: 'Done', type: 'end' },
  ],
  transitions: [
    { id: 'to-review', source: 'start', target: 'review', condition: 'user.role === "admin"' },
    { id: 'to-done', source: 'review', target: 'done', label: 'Continue' },
  ],
});

const workflow = (() => {
  const result = processWorkflowText(source, 'json');
  if (result.workflow === undefined) throw new Error('Inspector fixture must normalize.');
  return result.workflow;
})();

describe('P08 semantic inspector', () => {
  it('resolves a step from P07 semantic identity and Core-authored incident indexes', () => {
    const model = resolveSemanticSelection(workflow, { kind: 'step', id: 'review' });

    expect(model).toMatchObject({
      kind: 'step',
      id: 'review',
      type: 'action',
      status: 'not set',
    });
    if (model?.kind !== 'step') throw new Error('Expected a step model.');
    expect(model.incoming).toHaveLength(1);
    expect(model.incoming[0]?.condition).toBe('user.role === "admin"');
    expect(model.outgoing).toHaveLength(1);
  });

  it('resolves a transition from canonical internal identity without React Flow internals', () => {
    const transition = workflow.transitions[0];
    if (transition === undefined) throw new Error('Expected transition fixture.');
    const model = resolveSemanticSelection(workflow, {
      kind: 'transition',
      id: transition.internalId,
    });

    expect(model).toMatchObject({
      kind: 'transition',
      source: 'start',
      target: 'review',
      sourceDefinedId: 'to-review',
      condition: 'user.role === "admin"',
    });
  });

  it('renders labels, descriptions, conditions, and URL-looking metadata as inert text', () => {
    const model = resolveSemanticSelection(workflow, { kind: 'step', id: 'review' });
    const markup = renderToStaticMarkup(<Inspector model={model} />);

    expect(markup).toContain('&lt;script&gt;Review&lt;/script&gt;');
    expect(markup).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(markup).toContain('javascript:alert(1)');
    expect(markup).not.toContain('<script>');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('href="javascript:');
  });
});
