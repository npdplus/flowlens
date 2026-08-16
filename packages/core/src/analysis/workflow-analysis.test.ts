import { describe, expect, it } from 'vitest';

import {
  analyzeWorkflow,
  buildWorkflowGraphIndex,
  validateWorkflowSemantics,
  type CanonicalMetadata,
  type CanonicalStep,
  type CanonicalStepType,
  type CanonicalTransition,
  type CanonicalWorkflow,
} from '../index';

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
  condition?: string,
  metadata: CanonicalMetadata = {},
): CanonicalTransition => ({
  internalId: `internal:${sourceStepId}:${targetStepId}:${sequence}`,
  sourceStepId,
  targetStepId,
  ...(condition === undefined ? {} : { condition }),
  metadata,
});

const workflow = (
  steps: readonly CanonicalStep[],
  transitions: readonly CanonicalTransition[] = [],
  metadata: CanonicalMetadata = {},
): CanonicalWorkflow => ({
  schemaVersion: '0.1',
  id: 'analysis-test',
  name: 'Analysis Test',
  steps,
  transitions,
  metadata,
});

describe('P06 workflow analysis', () => {
  it('analyzes a single-step workflow without inventing topology', () => {
    const result = analyzeWorkflow(workflow([step('only')]));

    expect(result).toEqual({
      stepCount: 1,
      transitionCount: 0,
      decisionStepCount: 0,
      entry: {
        candidateStepIds: ['only'],
        candidateCount: 1,
        explicitStartStepIds: [],
        explicitStartCount: 0,
      },
      terminal: {
        candidateStepIds: ['only'],
        candidateCount: 1,
        explicitEndStepIds: [],
        explicitEndCount: 0,
      },
      branching: {
        stepIds: [],
        stepCount: 0,
        maximumOutgoingTransitionCount: 0,
      },
      cycles: {
        hasDirectedCycle: false,
        nonSelfCycleGroups: [],
        nonSelfCycleGroupCount: 0,
        cyclicStepIds: [],
      },
      selfLoops: { transitionCount: 0, stepIds: [], stepCount: 0 },
      components: { stepIdGroups: [['only']], count: 1, largestSize: 1 },
    });
  });

  it('reports sequential counts plus entry/start and terminal/end information', () => {
    const result = analyzeWorkflow(
      workflow(
        [step('start', 'start'), step('work'), step('end', 'end')],
        [transition('start', 'work'), transition('work', 'end')],
      ),
    );

    expect(result.stepCount).toBe(3);
    expect(result.transitionCount).toBe(2);
    expect(result.decisionStepCount).toBe(0);
    expect(result.entry).toEqual({
      candidateStepIds: ['start'],
      candidateCount: 1,
      explicitStartStepIds: ['start'],
      explicitStartCount: 1,
    });
    expect(result.terminal).toEqual({
      candidateStepIds: ['end'],
      candidateCount: 1,
      explicitEndStepIds: ['end'],
      explicitEndCount: 1,
    });
  });

  it('keeps declared decisions distinct from topological branching', () => {
    const result = analyzeWorkflow(
      workflow(
        [
          step('start', 'start'),
          step('declared', 'decision'),
          step('brancher'),
          step('left', 'end'),
          step('right', 'end'),
        ],
        [
          transition('start', 'declared'),
          transition('declared', 'brancher'),
          transition('brancher', 'left'),
          transition('brancher', 'right', 1),
        ],
      ),
    );

    expect(result.decisionStepCount).toBe(1);
    expect(result.branching).toEqual({
      stepIds: ['brancher'],
      stepCount: 1,
      maximumOutgoingTransitionCount: 2,
    });
  });

  it('reports branching step IDs in canonical order and the maximum outgoing count', () => {
    const result = analyzeWorkflow(
      workflow(
        [step('a'), step('b'), step('c'), step('d'), step('e')],
        [
          transition('a', 'b'),
          transition('a', 'c', 1),
          transition('b', 'c'),
          transition('b', 'd', 1),
          transition('b', 'e', 2),
        ],
      ),
    );

    expect(result.branching).toEqual({
      stepIds: ['a', 'b'],
      stepCount: 2,
      maximumOutgoingTransitionCount: 3,
    });
  });

  it('reports multiple topological entry candidates and explicit starts descriptively', () => {
    const result = analyzeWorkflow(
      workflow(
        [step('left', 'start'), step('right', 'start'), step('end', 'end')],
        [transition('left', 'end'), transition('right', 'end', 1)],
      ),
    );

    expect(result.entry).toEqual({
      candidateStepIds: ['left', 'right'],
      candidateCount: 2,
      explicitStartStepIds: ['left', 'right'],
      explicitStartCount: 2,
    });
  });

  it('reports multiple terminal paths and explicit ends descriptively', () => {
    const result = analyzeWorkflow(
      workflow(
        [step('start', 'start'), step('left', 'end'), step('right', 'end')],
        [transition('start', 'left'), transition('start', 'right', 1)],
      ),
    );

    expect(result.terminal).toEqual({
      candidateStepIds: ['left', 'right'],
      candidateCount: 2,
      explicitEndStepIds: ['left', 'right'],
      explicitEndCount: 2,
    });
  });

  it('summarizes a simple directed cycle without exhaustive path enumeration', () => {
    const result = analyzeWorkflow(
      workflow([step('a'), step('b')], [transition('a', 'b'), transition('b', 'a')]),
    );

    expect(result.cycles).toEqual({
      hasDirectedCycle: true,
      nonSelfCycleGroups: [{ stepIds: ['a', 'b'] }],
      nonSelfCycleGroupCount: 1,
      cyclicStepIds: ['a', 'b'],
    });
    expect(result.selfLoops).toEqual({ transitionCount: 0, stepIds: [], stepCount: 0 });
  });

  it('orders multi-node cycle members by canonical step order', () => {
    const result = analyzeWorkflow(
      workflow(
        [step('c'), step('a'), step('b'), step('exit')],
        [
          transition('a', 'b'),
          transition('b', 'c'),
          transition('c', 'a'),
          transition('c', 'exit', 1),
        ],
      ),
    );

    expect(result.cycles.nonSelfCycleGroups).toEqual([{ stepIds: ['c', 'a', 'b'] }]);
    expect(result.cycles.cyclicStepIds).toEqual(['c', 'a', 'b']);
  });

  it('keeps self-loops separate while still reporting directed-cycle presence', () => {
    const result = analyzeWorkflow(workflow([step('retry')], [transition('retry', 'retry')]));

    expect(result.cycles).toEqual({
      hasDirectedCycle: true,
      nonSelfCycleGroups: [],
      nonSelfCycleGroupCount: 0,
      cyclicStepIds: ['retry'],
    });
    expect(result.selfLoops).toEqual({
      transitionCount: 1,
      stepIds: ['retry'],
      stepCount: 1,
    });
  });

  it('counts multiple self-loop transitions while listing each self-loop step once', () => {
    const result = analyzeWorkflow(
      workflow(
        [step('a'), step('b')],
        [transition('a', 'a'), transition('a', 'a', 1), transition('b', 'b', 2)],
      ),
    );

    expect(result.selfLoops).toEqual({
      transitionCount: 3,
      stepIds: ['a', 'b'],
      stepCount: 2,
    });
    expect(result.cycles.cyclicStepIds).toEqual(['a', 'b']);
  });

  it('handles a cycle with an exit without pulling the exit into the cycle group', () => {
    const result = analyzeWorkflow(
      workflow(
        [step('a'), step('b'), step('end', 'end')],
        [transition('a', 'b'), transition('b', 'a'), transition('b', 'end', 1)],
      ),
    );

    expect(result.cycles.nonSelfCycleGroups).toEqual([{ stepIds: ['a', 'b'] }]);
    expect(result.terminal.candidateStepIds).toEqual(['end']);
  });

  it('orders multiple cycle groups deterministically by canonical step order', () => {
    const result = analyzeWorkflow(
      workflow(
        [step('x'), step('a'), step('b'), step('y')],
        [transition('a', 'b'), transition('b', 'a'), transition('x', 'y'), transition('y', 'x')],
      ),
    );

    expect(result.cycles.nonSelfCycleGroups).toEqual([
      { stepIds: ['x', 'y'] },
      { stepIds: ['a', 'b'] },
    ]);
    expect(result.cycles.cyclicStepIds).toEqual(['x', 'a', 'b', 'y']);
  });

  it('reports stable weak components and largest component size', () => {
    const result = analyzeWorkflow(
      workflow(
        [step('a'), step('b'), step('c'), step('d'), step('alone')],
        [transition('a', 'b'), transition('b', 'c'), transition('d', 'd')],
      ),
    );

    expect(result.components).toEqual({
      stepIdGroups: [['a', 'b', 'c'], ['d'], ['alone']],
      count: 3,
      largestSize: 3,
    });
  });

  it('keeps component members in canonical order regardless of transition order', () => {
    const result = analyzeWorkflow(
      workflow(
        [step('first'), step('second'), step('third')],
        [transition('third', 'second'), transition('second', 'first')],
      ),
    );

    expect(result.components.stepIdGroups).toEqual([['first', 'second', 'third']]);
  });

  it('returns identical analysis across repeated runs', () => {
    const input = workflow(
      [step('start', 'start'), step('decision', 'decision'), step('a'), step('b')],
      [
        transition('start', 'decision'),
        transition('decision', 'a'),
        transition('decision', 'b', 1),
      ],
    );

    expect(analyzeWorkflow(input)).toEqual(analyzeWorkflow(input));
  });

  it('returns equivalent analysis for equivalent canonical workflow values', () => {
    const first = workflow(
      [step('start', 'start'), step('end', 'end')],
      [transition('start', 'end')],
    );
    const second = structuredClone(first);

    expect(analyzeWorkflow(second)).toEqual(analyzeWorkflow(first));
  });

  it('does not mutate the canonical workflow', () => {
    const input = workflow(
      [step('start', 'start'), step('end', 'end')],
      [transition('start', 'end')],
      { nested: { value: ['safe'] } },
    );
    const before = structuredClone(input);

    analyzeWorkflow(input);

    expect(input).toEqual(before);
  });

  it('does not alter the semantic validation result', () => {
    const input = workflow([step('a'), step('b')], [transition('a', 'b'), transition('b', 'a')]);
    const before = validateWorkflowSemantics(input);

    analyzeWorkflow(input);

    expect(validateWorkflowSemantics(input)).toEqual(before);
  });

  it('treats conditions and metadata as inert data', () => {
    const topology = [step('a'), step('b')];
    const plain = workflow(topology, [transition('a', 'b')]);
    const hostileLooking = workflow(
      topology,
      [
        transition('a', 'b', 0, 'globalThis.__flowlensExecuted = true', {
          url: 'javascript:alert(1)',
          html: '<script>throw new Error()</script>',
        }),
      ],
      { expression: '(() => { throw new Error("executed") })()' },
    );

    expect(analyzeWorkflow(hostileLooking)).toEqual(analyzeWorkflow(plain));
  });

  it('preserves the P05 authored-versus-traversable edge distinction', () => {
    const input = workflow(
      [step('a'), step('b')],
      [transition('a', 'missing-1'), transition('a', 'missing-2', 1)],
    );
    const graph = buildWorkflowGraphIndex(input);
    const result = analyzeWorkflow(input);

    expect(graph.outgoingTransitionsByStepId.get('a')).toHaveLength(2);
    expect(graph.validOutgoingTransitionsByStepId.get('a')).toHaveLength(0);
    expect(graph.validTransitions).toHaveLength(0);
    expect(result.branching).toEqual({
      stepIds: ['a'],
      stepCount: 1,
      maximumOutgoingTransitionCount: 2,
    });
    expect(result.components.stepIdGroups).toEqual([['a'], ['b']]);
  });

  it('counts canonical transitions even when a semantic reference is broken', () => {
    const result = analyzeWorkflow(workflow([step('a')], [transition('a', 'missing')]));

    expect(result.transitionCount).toBe(1);
    expect(result.cycles.hasDirectedCycle).toBe(false);
    expect(result.components.stepIdGroups).toEqual([['a']]);
  });

  it('terminates safely on a 1,000-step synthetic linear graph', () => {
    const steps = Array.from({ length: 1_000 }, (_, index) => step(`step-${index}`));
    const transitions = Array.from({ length: 999 }, (_, index) =>
      transition(`step-${index}`, `step-${index + 1}`, index),
    );

    const result = analyzeWorkflow(workflow(steps, transitions));

    expect(result.stepCount).toBe(1_000);
    expect(result.transitionCount).toBe(999);
    expect(result.entry.candidateStepIds).toEqual(['step-0']);
    expect(result.terminal.candidateStepIds).toEqual(['step-999']);
    expect(result.components).toMatchObject({ count: 1, largestSize: 1_000 });
    expect(result.cycles.hasDirectedCycle).toBe(false);
  });

  it('terminates safely on a 1,000-step high-branching synthetic graph', () => {
    const steps = Array.from({ length: 1_000 }, (_, index) => step(`step-${index}`));
    const transitions = Array.from({ length: 999 }, (_, index) =>
      transition('step-0', `step-${index + 1}`, index),
    );

    const result = analyzeWorkflow(workflow(steps, transitions));

    expect(result.branching).toEqual({
      stepIds: ['step-0'],
      stepCount: 1,
      maximumOutgoingTransitionCount: 999,
    });
    expect(result.terminal.candidateCount).toBe(999);
    expect(result.components).toMatchObject({ count: 1, largestSize: 1_000 });
  });
});
