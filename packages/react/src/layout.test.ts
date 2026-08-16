import { describe, expect, it } from 'vitest';
import type {
  CanonicalStep,
  CanonicalStepType,
  CanonicalTransition,
  CanonicalWorkflow,
} from '@flowlens/core';

import { layoutWorkflow, type FlowLensLayoutEngine } from './layout';

const step = (id: string, type: CanonicalStepType = 'action'): CanonicalStep => ({
  id,
  label: id,
  type,
  metadata: {},
});

const transition = (
  sourceStepId: string,
  targetStepId: string,
  sequence = 0,
): CanonicalTransition => ({
  internalId: `transition:${sourceStepId}:${targetStepId}:${sequence}`,
  sourceStepId,
  targetStepId,
  metadata: {},
});

const workflow = (
  steps: readonly CanonicalStep[],
  transitions: readonly CanonicalTransition[],
): CanonicalWorkflow => ({
  schemaVersion: '0.1',
  name: 'Renderer fixture',
  steps,
  transitions,
  metadata: {},
});

const entries = async (input: CanonicalWorkflow) => {
  const result = await layoutWorkflow(input);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return Array.from(result.positions.entries());
};

describe('P07 ELK workflow layout', () => {
  it('lays out a sequential workflow top-to-bottom', async () => {
    const input = workflow(
      [step('start', 'start'), step('work'), step('end', 'end')],
      [transition('start', 'work'), transition('work', 'end')],
    );
    const positions = new Map(await entries(input));

    expect(positions.get('start')?.y).toBeLessThan(positions.get('work')?.y ?? 0);
    expect(positions.get('work')?.y).toBeLessThan(positions.get('end')?.y ?? 0);
  });

  it('lays out a branching workflow with distinct branch positions', async () => {
    const input = workflow(
      [step('start', 'start'), step('decision', 'decision'), step('yes'), step('no')],
      [
        transition('start', 'decision'),
        transition('decision', 'yes'),
        transition('decision', 'no', 1),
      ],
    );
    const positions = new Map(await entries(input));

    expect(positions.get('yes')).not.toEqual(positions.get('no'));
    expect(positions.get('yes')?.y).toBeGreaterThan(positions.get('decision')?.y ?? 0);
    expect(positions.get('no')?.y).toBeGreaterThan(positions.get('decision')?.y ?? 0);
  });

  it('lays out multiple terminal steps without merging them', async () => {
    const input = workflow(
      [step('start', 'start'), step('left', 'end'), step('right', 'end')],
      [transition('start', 'left'), transition('start', 'right', 1)],
    );
    const positions = new Map(await entries(input));

    expect(positions.size).toBe(3);
    expect(positions.get('left')).not.toEqual(positions.get('right'));
  });

  it('completes layout for a directed cycle', async () => {
    const input = workflow(
      [step('a'), step('b'), step('end', 'end')],
      [transition('a', 'b'), transition('b', 'a'), transition('b', 'end', 1)],
    );

    expect(await entries(input)).toHaveLength(3);
  });

  it('keeps a self-loop representable during layout', async () => {
    const input = workflow([step('retry')], [transition('retry', 'retry')]);

    expect(await entries(input)).toHaveLength(1);
  });

  it('lays out disconnected components without inventing transitions', async () => {
    const input = workflow(
      [step('a'), step('b'), step('c'), step('d')],
      [transition('a', 'b'), transition('c', 'd')],
    );
    const positions = await entries(input);

    expect(positions).toHaveLength(4);
    expect(new Set(positions.map(([, position]) => `${position.x}:${position.y}`)).size).toBe(4);
  });

  it('produces stable positions for repeated equivalent input', async () => {
    const input = workflow(
      [step('start', 'start'), step('decision', 'decision'), step('a'), step('b')],
      [
        transition('start', 'decision'),
        transition('decision', 'a'),
        transition('decision', 'b', 1),
      ],
    );

    expect(await entries(structuredClone(input))).toEqual(await entries(input));
  });

  it('does not mutate canonical workflow data', async () => {
    const input = workflow(
      [step('start', 'start'), step('end', 'end')],
      [transition('start', 'end')],
    );
    const before = structuredClone(input);

    await layoutWorkflow(input);

    expect(input).toEqual(before);
  });

  it('returns a controlled error without leaking layout internals', async () => {
    const failingEngine: FlowLensLayoutEngine = {
      layout: () => Promise.reject(new Error('sensitive engine stack detail')),
    };
    const result = await layoutWorkflow(workflow([step('only')], []), failingEngine);

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'layout',
        code: 'layout-failed',
        message: 'Unable to lay out this workflow diagram.',
      },
    });
    expect(JSON.stringify(result)).not.toContain('sensitive engine stack detail');
  });

  it('uses only Core-traversable transitions for layout adjacency', async () => {
    const input = workflow(
      [step('a'), step('b')],
      [transition('a', 'missing'), transition('a', 'b', 1)],
    );

    expect(await entries(input)).toHaveLength(2);
  });
});
