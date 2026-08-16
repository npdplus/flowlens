import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  CANONICAL_STEP_STATUSES,
  CANONICAL_STEP_TYPES,
  type CanonicalMetadata,
  type CanonicalStep,
  type CanonicalStepStatus,
  type CanonicalStepType,
  type CanonicalTransition,
  type CanonicalWorkflow,
} from '../index';

const createStep = (id: string, type: CanonicalStepType = 'action'): CanonicalStep => ({
  id,
  label: id,
  type,
  metadata: {},
});

const createTransition = (
  internalId: string,
  sourceStepId: string,
  targetStepId: string,
): CanonicalTransition => ({
  internalId,
  sourceStepId,
  targetStepId,
  metadata: {},
});

const createWorkflow = (
  steps: readonly CanonicalStep[],
  transitions: readonly CanonicalTransition[],
): CanonicalWorkflow => ({
  schemaVersion: '0.1',
  name: 'Contract Test Workflow',
  steps,
  transitions,
  metadata: {},
});

describe('canonical workflow domain contract', () => {
  it('represents exactly the supported V0.1 step types', () => {
    expect(CANONICAL_STEP_TYPES).toEqual(['start', 'action', 'decision', 'end']);
    expectTypeOf<CanonicalStep['type']>().toEqualTypeOf<CanonicalStepType>();
  });

  it('represents exactly the supported V0.1 statuses', () => {
    expect(CANONICAL_STEP_STATUSES).toEqual([
      'pending',
      'active',
      'success',
      'warning',
      'failed',
      'skipped',
    ]);
    expectTypeOf<CanonicalStepStatus>().toEqualTypeOf<CanonicalStep['status'] & string>();
  });

  it('represents a workflow without an optional workflow ID', () => {
    const workflow = createWorkflow([createStep('only')], []);

    expect(workflow.id).toBeUndefined();
  });

  it('represents a workflow without an optional description', () => {
    const workflow = createWorkflow([createStep('only')], []);

    expect(workflow.description).toBeUndefined();
  });

  it('represents a step without an optional status', () => {
    const step = createStep('review');

    expect(step.status).toBeUndefined();
  });

  it('keeps internal transition identity distinct when source-defined ID is omitted', () => {
    const transition = createTransition('internal:request:review:0', 'request', 'review');

    expect(transition.internalId).toBe('internal:request:review:0');
    expect(transition.sourceDefinedId).toBeUndefined();
  });

  it('preserves transition condition as opaque plain text', () => {
    const condition = 'approved === true && doNotExecute()';
    const transition: CanonicalTransition = {
      ...createTransition('internal:decision:approved:0', 'decision', 'approved'),
      condition,
    };

    expect(transition.condition).toBe(condition);
  });

  it('supports nested JSON-compatible metadata', () => {
    const metadata: CanonicalMetadata = {
      owner: 'platform',
      retryCount: 3,
      enabled: true,
      note: null,
      tags: ['review', 2, false, null],
      config: {
        threshold: 0.75,
        nested: [{ key: 'value' }],
      },
    };
    const workflow: CanonicalWorkflow = {
      ...createWorkflow([createStep('only')], []),
      metadata,
    };

    expect(workflow.metadata).toEqual(metadata);
  });

  it('represents cyclic topology without rejecting it at the model level', () => {
    const workflow = createWorkflow(
      [createStep('a'), createStep('b')],
      [createTransition('t1', 'a', 'b'), createTransition('t2', 'b', 'a')],
    );

    expect(workflow.transitions).toHaveLength(2);
    expect(workflow.transitions[1]?.targetStepId).toBe('a');
  });

  it('represents a self-loop', () => {
    const workflow = createWorkflow(
      [createStep('retry')],
      [createTransition('self', 'retry', 'retry')],
    );

    expect(workflow.transitions[0]?.sourceStepId).toBe(workflow.transitions[0]?.targetStepId);
  });

  it('represents disconnected components without inventing topology', () => {
    const workflow = createWorkflow(
      [createStep('a'), createStep('b'), createStep('isolated')],
      [createTransition('t1', 'a', 'b')],
    );

    expect(workflow.steps).toHaveLength(3);
    expect(workflow.transitions).toEqual([
      {
        internalId: 't1',
        sourceStepId: 'a',
        targetStepId: 'b',
        metadata: {},
      },
    ]);
  });

  it('represents multiple start and end typed steps', () => {
    const workflow = createWorkflow(
      [
        createStep('start-a', 'start'),
        createStep('start-b', 'start'),
        createStep('end-a', 'end'),
        createStep('end-b', 'end'),
      ],
      [],
    );

    expect(workflow.steps.filter((step) => step.type === 'start')).toHaveLength(2);
    expect(workflow.steps.filter((step) => step.type === 'end')).toHaveLength(2);
  });

  it('requires no renderer, layout, diagnostic, or analysis fields for canonical construction', () => {
    const workflow = createWorkflow([createStep('only')], []);

    expect(workflow).toEqual({
      schemaVersion: '0.1',
      name: 'Contract Test Workflow',
      steps: [{ id: 'only', label: 'only', type: 'action', metadata: {} }],
      transitions: [],
      metadata: {},
    });
    expect(workflow).not.toHaveProperty('x');
    expect(workflow).not.toHaveProperty('diagnostics');
    expect(workflow).not.toHaveProperty('analysis');
  });
});
