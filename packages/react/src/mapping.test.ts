import { describe, expect, it } from 'vitest';
import type {
  CanonicalStep,
  CanonicalStepStatus,
  CanonicalStepType,
  CanonicalTransition,
  CanonicalWorkflow,
} from '@flowlens/core';

import { mapWorkflowToRenderer } from './mapping';
import type { FlowLensLayoutSuccess } from './types';

const step = (
  id: string,
  type: CanonicalStepType = 'action',
  status?: CanonicalStepStatus,
): CanonicalStep => ({
  id,
  label: `Label ${id}`,
  type,
  ...(status === undefined ? {} : { status }),
  metadata: {},
});

const transition = (
  sourceStepId: string,
  targetStepId: string,
  sequence = 0,
  values: { readonly label?: string; readonly condition?: string } = {},
): CanonicalTransition => ({
  internalId: `internal:${sourceStepId}:${targetStepId}:${sequence}`,
  sourceStepId,
  targetStepId,
  ...(values.label === undefined ? {} : { label: values.label }),
  ...(values.condition === undefined ? {} : { condition: values.condition }),
  metadata: {},
});

const workflow = (
  steps: readonly CanonicalStep[],
  transitions: readonly CanonicalTransition[] = [],
): CanonicalWorkflow => ({
  schemaVersion: '0.1',
  name: 'Mapping fixture',
  steps,
  transitions,
  metadata: {},
});

const layoutFor = (input: CanonicalWorkflow): FlowLensLayoutSuccess => ({
  ok: true,
  positions: new Map(
    input.steps.map((item, index) => [item.id, { x: index * 100, y: index * 120 }]),
  ),
  bounds: { width: 800, height: 600 },
});

describe('P07 canonical to renderer mapping', () => {
  it('maps every canonical step to a renderer node with semantic identity in data', () => {
    const input = workflow([step('start', 'start'), step('work'), step('end', 'end')]);
    const model = mapWorkflowToRenderer(input, layoutFor(input));

    expect(model.nodes.map((node) => node.data.stepId)).toEqual(['start', 'work', 'end']);
    expect(model.nodes.map((node) => node.id)).toEqual([
      'flowlens-step-0',
      'flowlens-step-1',
      'flowlens-step-2',
    ]);
  });

  it('maps start/action/decision/end types to distinct controlled classes', () => {
    const input = workflow([
      step('s', 'start'),
      step('a', 'action'),
      step('d', 'decision'),
      step('e', 'end'),
    ]);
    const model = mapWorkflowToRenderer(input, layoutFor(input));

    expect(model.nodes.map((node) => node.className)).toEqual([
      expect.stringContaining('flowlens-step--start'),
      expect.stringContaining('flowlens-step--action'),
      expect.stringContaining('flowlens-step--decision'),
      expect.stringContaining('flowlens-step--end'),
    ]);
  });

  it('maps all canonical statuses to visible text plus symbols', () => {
    const statuses: readonly CanonicalStepStatus[] = [
      'pending',
      'active',
      'success',
      'warning',
      'failed',
      'skipped',
    ];
    const input = workflow(statuses.map((status) => step(status, 'action', status)));
    const model = mapWorkflowToRenderer(input, layoutFor(input));

    expect(model.nodes.map((node) => node.data.statusLabel)).toEqual([
      'Pending',
      'Active',
      'Success',
      'Warning',
      'Failed',
      'Skipped',
    ]);
    expect(model.nodes.every((node) => node.data.statusSymbol.length > 0)).toBe(true);
  });

  it('renders missing status as a neutral non-color state', () => {
    const input = workflow([step('neutral')]);
    const [node] = mapWorkflowToRenderer(input, layoutFor(input)).nodes;

    expect(node?.data.status).toBeUndefined();
    expect(node?.data.statusLabel).toBe('No status');
    expect(node?.data.statusSymbol).toBe('—');
    expect(node?.className).toContain('flowlens-step--status-neutral');
  });

  it('preserves transition label and condition as inert renderer text', () => {
    const input = workflow(
      [step('decision', 'decision'), step('approved', 'end')],
      [transition('decision', 'approved', 0, { label: 'Approve', condition: 'amount < 1000' })],
    );
    const [edge] = mapWorkflowToRenderer(input, layoutFor(input)).edges;

    expect(edge?.data).toMatchObject({
      sourceStepId: 'decision',
      targetStepId: 'approved',
      label: 'Approve',
      condition: 'amount < 1000',
    });
    expect(edge?.label).toBe('Approve · Condition: amount < 1000');
  });

  it('preserves semantic source and target identity separately from React Flow IDs', () => {
    const input = workflow([step('source'), step('target')], [transition('source', 'target')]);
    const [edge] = mapWorkflowToRenderer(input, layoutFor(input)).edges;

    expect(edge?.source).toBe('flowlens-step-0');
    expect(edge?.target).toBe('flowlens-step-1');
    expect(edge?.data?.sourceStepId).toBe('source');
    expect(edge?.data?.targetStepId).toBe('target');
  });

  it('keeps multi-way outgoing branches as separate renderer edges', () => {
    const input = workflow(
      [step('decision', 'decision'), step('a'), step('b'), step('c')],
      [transition('decision', 'a'), transition('decision', 'b', 1), transition('decision', 'c', 2)],
    );
    const model = mapWorkflowToRenderer(input, layoutFor(input));

    expect(model.edges).toHaveLength(3);
    expect(model.edges.map((edge) => edge.data?.targetStepId)).toEqual(['a', 'b', 'c']);
  });

  it('keeps a self-loop as an edge whose renderer source and target match', () => {
    const input = workflow([step('retry')], [transition('retry', 'retry')]);
    const [edge] = mapWorkflowToRenderer(input, layoutFor(input)).edges;

    expect(edge?.source).toBe('flowlens-step-0');
    expect(edge?.target).toBe('flowlens-step-0');
  });

  it('keeps directed cycles as authored edges without traversal', () => {
    const input = workflow([step('a'), step('b')], [transition('a', 'b'), transition('b', 'a', 1)]);
    const model = mapWorkflowToRenderer(input, layoutFor(input));

    expect(model.edges.map((edge) => [edge.data?.sourceStepId, edge.data?.targetStepId])).toEqual([
      ['a', 'b'],
      ['b', 'a'],
    ]);
  });

  it('keeps disconnected canonical nodes in the renderer model', () => {
    const input = workflow([step('a'), step('b'), step('isolated')], [transition('a', 'b')]);
    const model = mapWorkflowToRenderer(input, layoutFor(input));

    expect(model.nodes.map((node) => node.data.stepId)).toEqual(['a', 'b', 'isolated']);
  });

  it('keeps a broken-reference transition represented rather than repairing topology', () => {
    const input = workflow([step('a')], [transition('a', 'missing')]);
    const [edge] = mapWorkflowToRenderer(input, layoutFor(input)).edges;

    expect(edge?.data?.targetStepId).toBe('missing');
    expect(edge?.target).toBe('flowlens-missing-target-0');
  });

  it('makes renderer nodes and edges read-only for workflow semantics', () => {
    const input = workflow([step('a'), step('b')], [transition('a', 'b')]);
    const model = mapWorkflowToRenderer(input, layoutFor(input));

    expect(model.nodes[0]).toMatchObject({
      draggable: false,
      connectable: false,
      deletable: false,
    });
    expect(model.edges[0]).toMatchObject({ reconnectable: false, deletable: false });
  });

  it('does not mutate the canonical workflow while mapping', () => {
    const input = workflow([step('a'), step('b')], [transition('a', 'b')]);
    const before = structuredClone(input);

    mapWorkflowToRenderer(input, layoutFor(input));

    expect(input).toEqual(before);
  });
});
