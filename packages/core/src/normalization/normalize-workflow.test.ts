import { describe, expect, it } from 'vitest';

import {
  createTransitionInternalId,
  normalizeWorkflowDefinition,
  type NormalizationCompatibleWorkflowDefinition,
} from '../index';

const createDefinition = (
  overrides: Partial<NormalizationCompatibleWorkflowDefinition> = {},
): NormalizationCompatibleWorkflowDefinition => ({
  schemaVersion: '0.1',
  name: 'Normalization Test',
  steps: [{ id: 'start', label: 'Start' }],
  transitions: [],
  ...overrides,
});

describe('normalizeWorkflowDefinition', () => {
  it('normalizes a minimal structurally compatible workflow', () => {
    expect(normalizeWorkflowDefinition(createDefinition())).toEqual({
      schemaVersion: '0.1',
      name: 'Normalization Test',
      steps: [{ id: 'start', label: 'Start', type: 'action', metadata: {} }],
      transitions: [],
      metadata: {},
    });
  });

  it('preserves an optional workflow ID', () => {
    expect(normalizeWorkflowDefinition(createDefinition({ id: 'approval' })).id).toBe('approval');
  });

  it('preserves an optional workflow description', () => {
    expect(
      normalizeWorkflowDefinition(createDefinition({ description: 'Plain descriptive text' }))
        .description,
    ).toBe('Plain descriptive text');
  });

  it('defaults an omitted step type to action', () => {
    const workflow = normalizeWorkflowDefinition(createDefinition());

    expect(workflow.steps[0]?.type).toBe('action');
  });

  it('preserves each explicitly supported step type', () => {
    const workflow = normalizeWorkflowDefinition(
      createDefinition({
        steps: [
          { id: 's', label: 'S', type: 'start' },
          { id: 'a', label: 'A', type: 'action' },
          { id: 'd', label: 'D', type: 'decision' },
          { id: 'e', label: 'E', type: 'end' },
        ],
      }),
    );

    expect(workflow.steps.map((step) => step.type)).toEqual(['start', 'action', 'decision', 'end']);
  });

  it('preserves supplied status and absence of status', () => {
    const workflow = normalizeWorkflowDefinition(
      createDefinition({
        steps: [
          { id: 'a', label: 'A', status: 'warning' },
          { id: 'b', label: 'B' },
        ],
      }),
    );

    expect(workflow.steps[0]?.status).toBe('warning');
    expect(workflow.steps[1]?.status).toBeUndefined();
  });

  it('preserves transition source and target topology exactly', () => {
    const workflow = normalizeWorkflowDefinition(
      createDefinition({
        steps: [
          { id: 'b', label: 'B' },
          { id: 'a', label: 'A' },
        ],
        transitions: [{ source: 'a', target: 'b' }],
      }),
    );

    expect(workflow.transitions[0]).toMatchObject({ sourceStepId: 'a', targetStepId: 'b' });
  });

  it('preserves a transition label', () => {
    const workflow = normalizeWorkflowDefinition(
      createDefinition({ transitions: [{ source: 'start', target: 'done', label: 'Continue' }] }),
    );

    expect(workflow.transitions[0]?.label).toBe('Continue');
  });

  it('preserves conditions as opaque non-executable text', () => {
    const condition = 'globalThis.compromised = true';
    const workflow = normalizeWorkflowDefinition(
      createDefinition({ transitions: [{ source: 'start', target: 'done', condition }] }),
    );

    expect(workflow.transitions[0]?.condition).toBe(condition);
    expect((globalThis as { compromised?: boolean }).compromised).toBeUndefined();
  });

  it('preserves JSON-compatible metadata and normalizes absent metadata to empty objects', () => {
    const metadata = {
      owner: 'platform',
      config: { enabled: true, threshold: 0.75 },
      tags: ['one', null, 2],
    } as const;
    const workflow = normalizeWorkflowDefinition(
      createDefinition({
        metadata,
        steps: [{ id: 'start', label: 'Start', metadata }],
        transitions: [{ source: 'start', target: 'done', metadata }],
      }),
    );

    expect(workflow.metadata).toEqual(metadata);
    expect(workflow.steps[0]?.metadata).toEqual(metadata);
    expect(workflow.transitions[0]?.metadata).toEqual(metadata);
  });

  it('preserves an explicit source transition ID separately from internal identity', () => {
    const workflow = normalizeWorkflowDefinition(
      createDefinition({
        transitions: [{ id: 'approved-path', source: 'start', target: 'done' }],
      }),
    );
    const transition = workflow.transitions[0];

    expect(transition?.sourceDefinedId).toBe('approved-path');
    expect(transition?.internalId).toBe(createTransitionInternalId('start', 'done', 0));
    expect(transition?.internalId).not.toBe(transition?.sourceDefinedId);
  });

  it('generates deterministic internal transition identity', () => {
    const definition = createDefinition({
      transitions: [
        { source: 'start', target: 'review' },
        { source: 'review', target: 'done' },
      ],
    });

    const first = normalizeWorkflowDefinition(definition);
    const second = normalizeWorkflowDefinition(definition);

    expect(first.transitions.map((transition) => transition.internalId)).toEqual(
      second.transitions.map((transition) => transition.internalId),
    );
  });

  it('uses stable pair occurrence order for repeated source/target transitions', () => {
    const workflow = normalizeWorkflowDefinition(
      createDefinition({
        transitions: [
          { source: 'a', target: 'b', label: 'first' },
          { source: 'x', target: 'y' },
          { source: 'a', target: 'b', label: 'second' },
        ],
      }),
    );

    expect(workflow.transitions.map((transition) => transition.internalId)).toEqual([
      'transition:1:a:1:b:0',
      'transition:1:x:1:y:0',
      'transition:1:a:1:b:1',
    ]);
    expect(new Set(workflow.transitions.map((transition) => transition.internalId)).size).toBe(3);
  });

  it('preserves cycle topology', () => {
    const workflow = normalizeWorkflowDefinition(
      createDefinition({
        steps: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        transitions: [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'a' },
        ],
      }),
    );

    expect(
      workflow.transitions.map(({ sourceStepId, targetStepId }) => [sourceStepId, targetStepId]),
    ).toEqual([
      ['a', 'b'],
      ['b', 'a'],
    ]);
  });

  it('preserves a self-loop', () => {
    const workflow = normalizeWorkflowDefinition(
      createDefinition({ transitions: [{ source: 'start', target: 'start' }] }),
    );

    expect(workflow.transitions[0]).toMatchObject({ sourceStepId: 'start', targetStepId: 'start' });
  });

  it('preserves disconnected components without inventing transitions', () => {
    const workflow = normalizeWorkflowDefinition(
      createDefinition({
        steps: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'isolated', label: 'Isolated' },
        ],
        transitions: [{ source: 'a', target: 'b' }],
      }),
    );

    expect(workflow.steps.map((step) => step.id)).toEqual(['a', 'b', 'isolated']);
    expect(workflow.transitions).toHaveLength(1);
  });

  it('does not mutate a frozen source object', () => {
    const step = Object.freeze({
      id: 'start',
      label: 'Start',
      metadata: Object.freeze({ nested: Object.freeze({ value: 'kept' }) }),
    });
    const transition = Object.freeze({ source: 'start', target: 'missing' });
    const definition: NormalizationCompatibleWorkflowDefinition = Object.freeze({
      schemaVersion: '0.1',
      name: 'Frozen',
      steps: Object.freeze([step]),
      transitions: Object.freeze([transition]),
      metadata: Object.freeze({ owner: 'test' }),
    });
    const before = JSON.stringify(definition);

    const workflow = normalizeWorkflowDefinition(definition);

    expect(JSON.stringify(definition)).toBe(before);
    expect(workflow.steps[0]?.type).toBe('action');
    expect(workflow.transitions[0]?.targetStepId).toBe('missing');
  });

  it('does not repair duplicate step IDs', () => {
    const workflow = normalizeWorkflowDefinition(
      createDefinition({
        steps: [
          { id: 'duplicate', label: 'One' },
          { id: 'duplicate', label: 'Two' },
        ],
      }),
    );

    expect(workflow.steps.map((step) => step.id)).toEqual(['duplicate', 'duplicate']);
  });

  it('does not guess an unknown transition target', () => {
    const workflow = normalizeWorkflowDefinition(
      createDefinition({ transitions: [{ source: 'start', target: 'not-declared' }] }),
    );

    expect(workflow.transitions[0]?.targetStepId).toBe('not-declared');
  });
});
