import { describe, expect, it } from 'vitest';

import {
  buildWorkflowGraphIndex,
  validateWorkflowSemantics,
  type CanonicalStep,
  type CanonicalStepType,
  type CanonicalTransition,
  type CanonicalWorkflow,
  type SemanticValidationResult,
} from '../index';

const step = (id: string, type: CanonicalStepType = 'action', label = id): CanonicalStep => ({
  id,
  label,
  type,
  metadata: {},
});

let transitionSequence = 0;
const transition = (
  sourceStepId: string,
  targetStepId: string,
  sourceDefinedId?: string,
  condition?: string,
): CanonicalTransition => {
  const internalId = `internal:${transitionSequence}`;
  transitionSequence += 1;
  return {
    internalId,
    ...(sourceDefinedId === undefined ? {} : { sourceDefinedId }),
    sourceStepId,
    targetStepId,
    ...(condition === undefined ? {} : { condition }),
    metadata: {},
  };
};

const workflow = (
  steps: readonly CanonicalStep[],
  transitions: readonly CanonicalTransition[] = [],
): CanonicalWorkflow => ({
  schemaVersion: '0.1',
  id: 'semantic-test',
  name: 'Semantic Test',
  steps,
  transitions,
  metadata: {},
});

const diagnosticByCode = (result: SemanticValidationResult, code: string) =>
  result.diagnostics.find((diagnostic) => diagnostic.code === code);

const diagnosticsByCode = (result: SemanticValidationResult, code: string) =>
  result.diagnostics.filter((diagnostic) => diagnostic.code === code);

describe('P05 semantic validation', () => {
  it('accepts unique step IDs without FL2001', () => {
    const result = validateWorkflowSemantics(
      workflow([step('start', 'start'), step('end', 'end')], [transition('start', 'end')]),
    );

    expect(diagnosticsByCode(result, 'FL2001')).toEqual([]);
  });

  it('reports duplicate step IDs as FL2001 error/semantic with deterministic context', () => {
    const result = validateWorkflowSemantics(workflow([step('same'), step('same')]));

    expect(diagnosticByCode(result, 'FL2001')).toMatchObject({
      code: 'FL2001',
      severity: 'error',
      category: 'semantic',
      path: 'steps[1].id',
      entity: { kind: 'step', id: 'same', index: 1 },
      details: { firstIndex: 0 },
    });
  });

  it('allows duplicate step labels', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('a', 'start', 'Same label'), step('b', 'end', 'Same label')],
        [transition('a', 'b')],
      ),
    );

    expect(diagnosticsByCode(result, 'FL2001')).toEqual([]);
  });

  it('treats step IDs as case-sensitive', () => {
    const result = validateWorkflowSemantics(
      workflow([step('Node', 'start'), step('node', 'end')], [transition('Node', 'node')]),
    );

    expect(diagnosticsByCode(result, 'FL2001')).toEqual([]);
    expect(diagnosticsByCode(result, 'FL2002')).toEqual([]);
    expect(diagnosticsByCode(result, 'FL2003')).toEqual([]);
  });

  it('accepts unique source-defined transition IDs', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('s', 'start'), step('e', 'end')],
        [transition('s', 'e', 'edge-a'), transition('s', 'e', 'edge-b')],
      ),
    );

    expect(diagnosticsByCode(result, 'FL2004')).toEqual([]);
  });

  it('reports duplicate source-defined transition IDs as FL2004 error/semantic', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('s', 'start'), step('e', 'end')],
        [transition('s', 'e', 'edge'), transition('s', 'e', 'edge')],
      ),
    );

    expect(diagnosticByCode(result, 'FL2004')).toMatchObject({
      code: 'FL2004',
      severity: 'error',
      category: 'semantic',
      path: 'transitions[1].id',
      entity: { kind: 'transition', id: 'edge', index: 1 },
      details: { firstIndex: 0 },
    });
  });

  it('allows transitions without source-defined IDs', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('s', 'start'), step('e', 'end')],
        [transition('s', 'e'), transition('s', 'e')],
      ),
    );

    expect(diagnosticsByCode(result, 'FL2004')).toEqual([]);
  });

  it('does not validate generated internal transition IDs as authored IDs', () => {
    const first = { ...transition('s', 'e'), internalId: 'generated:same' };
    const second = { ...transition('s', 'e'), internalId: 'generated:same' };
    const result = validateWorkflowSemantics(
      workflow([step('s', 'start'), step('e', 'end')], [first, second]),
    );

    expect(diagnosticsByCode(result, 'FL2004')).toEqual([]);
  });

  it('accepts known transition source and target references', () => {
    const result = validateWorkflowSemantics(
      workflow([step('s', 'start'), step('e', 'end')], [transition('s', 'e')]),
    );

    expect(diagnosticsByCode(result, 'FL2002')).toEqual([]);
    expect(diagnosticsByCode(result, 'FL2003')).toEqual([]);
  });

  it('reports unknown transition source as FL2002 error/semantic', () => {
    const result = validateWorkflowSemantics(
      workflow([step('e', 'end')], [transition('missing', 'e', 'edge')]),
    );

    expect(diagnosticByCode(result, 'FL2002')).toMatchObject({
      code: 'FL2002',
      severity: 'error',
      category: 'semantic',
      path: 'transitions[0].source',
      entity: { kind: 'transition', id: 'edge', index: 0 },
    });
  });

  it('reports unknown transition target as FL2003 error/semantic', () => {
    const result = validateWorkflowSemantics(
      workflow([step('s', 'start')], [transition('s', 'missing', 'edge')]),
    );

    expect(diagnosticByCode(result, 'FL2003')).toMatchObject({
      code: 'FL2003',
      severity: 'error',
      category: 'semantic',
      path: 'transitions[0].target',
      entity: { kind: 'transition', id: 'edge', index: 0 },
    });
  });

  it('accumulates multiple broken references in transition definition order', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('known')],
        [transition('missing-a', 'missing-b'), transition('missing-c', 'known')],
      ),
    );
    const references = result.diagnostics.filter(
      (diagnostic) => diagnostic.code === 'FL2002' || diagnostic.code === 'FL2003',
    );

    expect(references.map(({ code, path }) => [code, path])).toEqual([
      ['FL2002', 'transitions[0].source'],
      ['FL2003', 'transitions[0].target'],
      ['FL2002', 'transitions[1].source'],
    ]);
  });

  it('keeps a single-entry workflow free of FL2106 and FL2107', () => {
    const result = validateWorkflowSemantics(
      workflow([step('a'), step('b', 'end')], [transition('a', 'b')]),
    );

    expect(diagnosticsByCode(result, 'FL2106')).toEqual([]);
    expect(diagnosticsByCode(result, 'FL2107')).toEqual([]);
  });

  it('reports multiple topological entry candidates as FL2107 info/semantic', () => {
    const result = validateWorkflowSemantics(workflow([step('a'), step('b', 'end')]));

    expect(diagnosticByCode(result, 'FL2107')).toMatchObject({
      code: 'FL2107',
      severity: 'info',
      category: 'semantic',
      path: 'steps',
      entity: { kind: 'workflow', id: 'semantic-test' },
      details: { entryCount: 2 },
    });
  });

  it('reports a declared start with incoming transition as FL2101 warning/semantic', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('pre'), step('start', 'start'), step('end', 'end')],
        [transition('pre', 'start'), transition('start', 'end')],
      ),
    );

    expect(diagnosticByCode(result, 'FL2101')).toMatchObject({
      code: 'FL2101',
      severity: 'warning',
      category: 'semantic',
      path: 'steps[1].type',
      entity: { kind: 'step', id: 'start', index: 1 },
    });
  });

  it('reports multiple declared starts as FL2108 info/semantic', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('a', 'start'), step('b', 'start'), step('end', 'end')],
        [transition('a', 'end'), transition('b', 'end')],
      ),
    );

    expect(diagnosticByCode(result, 'FL2108')).toMatchObject({
      code: 'FL2108',
      severity: 'info',
      category: 'semantic',
      path: 'steps',
      details: { declaredStartCount: 2 },
    });
  });

  it('accepts an explicit terminal end with no outgoing transition', () => {
    const result = validateWorkflowSemantics(
      workflow([step('s', 'start'), step('e', 'end')], [transition('s', 'e')]),
    );

    expect(diagnosticsByCode(result, 'FL2102')).toEqual([]);
    expect(diagnosticsByCode(result, 'FL2104')).toEqual([]);
  });

  it('reports an explicit end with outgoing transition as FL2102 warning/semantic', () => {
    const result = validateWorkflowSemantics(
      workflow([step('end', 'end'), step('next')], [transition('end', 'next')]),
    );

    expect(diagnosticByCode(result, 'FL2102')).toMatchObject({
      code: 'FL2102',
      severity: 'warning',
      category: 'semantic',
      path: 'steps[0].type',
      entity: { kind: 'step', id: 'end', index: 0 },
    });
  });

  it('reports a dead-end non-end step as FL2104 warning/semantic', () => {
    const result = validateWorkflowSemantics(workflow([step('dead'), step('end', 'end')]));

    expect(diagnosticByCode(result, 'FL2104')).toMatchObject({
      code: 'FL2104',
      severity: 'warning',
      category: 'semantic',
      path: 'steps[0]',
      entity: { kind: 'step', id: 'dead', index: 0 },
    });
  });

  it('suppresses noisy FL2104 for a legitimate single-step workflow', () => {
    const result = validateWorkflowSemantics(workflow([step('only')]));

    expect(diagnosticsByCode(result, 'FL2104')).toEqual([]);
  });

  it('keeps a reachable branching workflow free of FL2103', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('s', 'start'), step('d', 'decision'), step('yes', 'end'), step('no', 'end')],
        [transition('s', 'd'), transition('d', 'yes'), transition('d', 'no')],
      ),
    );

    expect(diagnosticsByCode(result, 'FL2103')).toEqual([]);
  });

  it('reports an unreachable step as FL2103 warning/semantic', () => {
    const result = validateWorkflowSemantics(
      workflow([step('s', 'start'), step('end', 'end'), step('orphan')], [transition('s', 'end')]),
    );

    expect(diagnosticByCode(result, 'FL2103')).toMatchObject({
      code: 'FL2103',
      severity: 'warning',
      category: 'semantic',
      path: 'steps[2]',
      entity: { kind: 'step', id: 'orphan', index: 2 },
    });
  });

  it('reports a disconnected component when separate entry components are otherwise reachable', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('a'), step('b', 'end'), step('c'), step('d', 'end')],
        [transition('a', 'b'), transition('c', 'd')],
      ),
    );

    expect(diagnosticByCode(result, 'FL2109')).toMatchObject({
      code: 'FL2109',
      severity: 'warning',
      category: 'semantic',
      path: 'steps[2]',
      entity: { kind: 'step', id: 'c', index: 2 },
    });
  });

  it('suppresses FL2109 when FL2103 already communicates an unreachable component', () => {
    const result = validateWorkflowSemantics(
      workflow([step('s', 'start'), step('e', 'end'), step('orphan')], [transition('s', 'e')]),
    );

    expect(diagnosticsByCode(result, 'FL2103')).toHaveLength(1);
    expect(diagnosticsByCode(result, 'FL2109')).toEqual([]);
  });

  it('accepts a decision with two outgoing branches', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('d', 'decision'), step('yes', 'end'), step('no', 'end')],
        [transition('d', 'yes'), transition('d', 'no')],
      ),
    );

    expect(diagnosticsByCode(result, 'FL2105')).toEqual([]);
  });

  it('reports a decision with fewer than two outgoing transitions as FL2105 warning/semantic', () => {
    const result = validateWorkflowSemantics(
      workflow([step('d', 'decision'), step('e', 'end')], [transition('d', 'e')]),
    );

    expect(diagnosticByCode(result, 'FL2105')).toMatchObject({
      code: 'FL2105',
      severity: 'warning',
      category: 'semantic',
      path: 'steps[0].type',
      entity: { kind: 'step', id: 'd', index: 0 },
      details: { outgoingCount: 1 },
    });
  });

  it('reports a fully cyclic workflow with no entry candidate as FL2106 warning/semantic', () => {
    const result = validateWorkflowSemantics(
      workflow([step('a'), step('b')], [transition('a', 'b'), transition('b', 'a')]),
    );

    expect(diagnosticByCode(result, 'FL2106')).toMatchObject({
      code: 'FL2106',
      severity: 'warning',
      category: 'semantic',
      path: 'steps',
    });
  });

  it('terminates safely on a simple cycle and emits FL3001 info/analysis', () => {
    const result = validateWorkflowSemantics(
      workflow([step('a'), step('b')], [transition('a', 'b'), transition('b', 'a')]),
    );

    expect(diagnosticByCode(result, 'FL3001')).toMatchObject({
      code: 'FL3001',
      severity: 'info',
      category: 'analysis',
      path: 'transitions',
      entity: { kind: 'workflow', id: 'semantic-test' },
    });
  });

  it('terminates safely on a multi-node cycle and emits only one basic FL3001 notice', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('a'), step('b'), step('c')],
        [transition('a', 'b'), transition('b', 'c'), transition('c', 'a')],
      ),
    );

    expect(diagnosticsByCode(result, 'FL3001')).toHaveLength(1);
  });

  it('terminates safely on a self-loop and emits FL3002 info/analysis without FL3001 duplication', () => {
    const result = validateWorkflowSemantics(
      workflow([step('retry')], [transition('retry', 'retry')]),
    );

    expect(diagnosticByCode(result, 'FL3002')).toMatchObject({
      code: 'FL3002',
      severity: 'info',
      category: 'analysis',
      path: 'transitions[0]',
      entity: { kind: 'transition', index: 0 },
    });
    expect(diagnosticsByCode(result, 'FL3001')).toEqual([]);
  });

  it('keeps FL3001 and FL3002 in the D04 analysis/info category and severity', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('a'), step('b'), step('self')],
        [transition('a', 'b'), transition('b', 'a'), transition('self', 'self', 'loop')],
      ),
    );

    expect(diagnosticByCode(result, 'FL3001')).toMatchObject({
      severity: 'info',
      category: 'analysis',
    });
    expect(diagnosticByCode(result, 'FL3002')).toMatchObject({
      severity: 'info',
      category: 'analysis',
      entity: { kind: 'transition', id: 'loop', index: 2 },
    });
  });

  it('allows multiple terminal paths without inventing a single-end requirement', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('s', 'start'), step('left', 'end'), step('right', 'end')],
        [transition('s', 'left'), transition('s', 'right')],
      ),
    );

    expect(result.diagnostics).toEqual([]);
  });

  it('accumulates independent semantic errors deterministically', () => {
    const source = workflow(
      [step('same'), step('same'), step('known')],
      [
        transition('missing-source', 'known', 'duplicate-edge'),
        transition('known', 'missing-target', 'duplicate-edge'),
      ],
    );
    const first = validateWorkflowSemantics(source);
    const second = validateWorkflowSemantics(source);

    expect(first.diagnostics).toEqual(second.diagnostics);
    expect(
      first.diagnostics
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map(({ code, path }) => [code, path]),
    ).toEqual([
      ['FL2001', 'steps[1].id'],
      ['FL2002', 'transitions[0].source'],
      ['FL2004', 'transitions[1].id'],
      ['FL2003', 'transitions[1].target'],
    ]);
  });

  it('keeps diagnostic path and entity context deterministic across repeated validation', () => {
    const source = workflow([step('s')], [transition('s', 'missing')]);
    const first = validateWorkflowSemantics(source);
    const second = validateWorkflowSemantics(source);

    expect(first.diagnostics).toEqual(second.diagnostics);
    expect(diagnosticByCode(first, 'FL2003')).toMatchObject({
      path: 'transitions[0].target',
      entity: { kind: 'transition', index: 0 },
    });
  });

  it('marks semantic validation invalid when FL2001-FL2004 errors exist', () => {
    const result = validateWorkflowSemantics(workflow([step('a'), step('a')]));

    expect(result.isValid).toBe(false);
    expect(result.hasErrors).toBe(true);
  });

  it('keeps warnings-only semantic validation valid', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('pre'), step('s', 'start'), step('e', 'end')],
        [transition('pre', 's'), transition('s', 'e')],
      ),
    );

    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === 'warning')).toBe(true);
    expect(result.isValid).toBe(true);
    expect(result.hasErrors).toBe(false);
    expect(result.hasWarnings).toBe(true);
  });

  it('keeps info-only semantic validation valid', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('a', 'start'), step('b', 'start'), step('e', 'end')],
        [transition('a', 'e'), transition('b', 'e')],
      ),
    );

    expect(result.diagnostics.map(({ code }) => code)).toEqual(['FL2107', 'FL2108']);
    expect(result.isValid).toBe(true);
    expect(result.hasErrors).toBe(false);
    expect(result.hasWarnings).toBe(false);
  });

  it('does not mutate the canonical workflow', () => {
    const source = workflow(
      [step('s', 'start'), step('d', 'decision'), step('e', 'end')],
      [transition('s', 'd'), transition('d', 'e', 'edge', 'approved === true')],
    );
    const snapshot = structuredClone(source);

    validateWorkflowSemantics(source);

    expect(source).toEqual(snapshot);
  });

  it('keeps conditions inert opaque strings', () => {
    const condition = 'globalThis.sideEffect = executeDangerousThing()';
    const source = workflow(
      [step('s', 'start'), step('e', 'end')],
      [transition('s', 'e', undefined, condition)],
    );

    validateWorkflowSemantics(source);

    expect(source.transitions[0]?.condition).toBe(condition);
  });

  it('keeps metadata inert data', () => {
    const source: CanonicalWorkflow = {
      ...workflow([step('only')]),
      metadata: { url: 'https://example.invalid/do-not-fetch', script: '<script>no</script>' },
    };
    const metadata = source.metadata;

    validateWorkflowSemantics(source);

    expect(source.metadata).toBe(metadata);
    expect(source.metadata).toEqual({
      url: 'https://example.invalid/do-not-fetch',
      script: '<script>no</script>',
    });
  });

  it('does not crash graph traversal when references are broken', () => {
    const source = workflow(
      [step('a', 'start'), step('b', 'end')],
      [transition('missing', 'b'), transition('a', 'missing'), transition('a', 'b')],
    );

    expect(() => validateWorkflowSemantics(source)).not.toThrow();
    expect(validateWorkflowSemantics(source).isValid).toBe(false);
  });

  it('terminates safely on a 1,000-step synthetic workflow', () => {
    const steps = Array.from({ length: 1_000 }, (_, index) =>
      step(`s-${index}`, index === 999 ? 'end' : 'action'),
    );
    const transitions = Array.from({ length: 999 }, (_, index) =>
      transition(`s-${index}`, `s-${index + 1}`),
    );

    const result = validateWorkflowSemantics(workflow(steps, transitions));

    expect(result.isValid).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it('produces equivalent diagnostics for equivalent canonical input', () => {
    const first = workflow(
      [step('s', 'start'), step('d', 'decision'), step('e', 'end')],
      [transition('s', 'd'), transition('d', 'e')],
    );
    const second = structuredClone(first);

    expect(validateWorkflowSemantics(first).diagnostics).toEqual(
      validateWorkflowSemantics(second).diagnostics,
    );
  });

  it('orders step diagnostics by numeric canonical index rather than path string locale behavior', () => {
    const steps = Array.from({ length: 12 }, (_, index) => step(`id-${index}`));
    steps[2] = step('duplicate');
    steps[9] = step('duplicate');
    steps[10] = step('other');
    steps[11] = step('other');

    const result = validateWorkflowSemantics(workflow(steps));
    const duplicates = diagnosticsByCode(result, 'FL2001');

    expect(duplicates.map(({ path }) => path)).toEqual(['steps[9].id', 'steps[11].id']);
  });

  it('never exposes generated internal transition identity as diagnostic entity ID', () => {
    const edge = { ...transition('s', 'missing'), internalId: 'generated-private-identity' };
    const result = validateWorkflowSemantics(workflow([step('s')], [edge]));
    const diagnostic = diagnosticByCode(result, 'FL2003');

    expect(diagnostic?.entity).toEqual({ kind: 'transition', index: 0 });
    expect(diagnostic?.message).not.toContain('generated-private-identity');
  });

  it('uses source-defined transition identity as diagnostic entity ID when available', () => {
    const result = validateWorkflowSemantics(
      workflow([step('s')], [transition('s', 'missing', 'authored-edge')]),
    );

    expect(diagnosticByCode(result, 'FL2003')?.entity).toEqual({
      kind: 'transition',
      id: 'authored-edge',
      index: 0,
    });
  });

  it('uses declared starts as reachability roots when they exist', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('pre'), step('s', 'start'), step('e', 'end')],
        [transition('pre', 's'), transition('s', 'e')],
      ),
    );

    expect(diagnosticsByCode(result, 'FL2103')).toHaveLength(1);
    expect(diagnosticByCode(result, 'FL2103')?.entity).toMatchObject({ id: 'pre', index: 0 });
  });

  it('uses all discovered entry candidates as reachability roots when no start is declared', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('a'), step('b', 'end'), step('c'), step('d', 'end')],
        [transition('a', 'b'), transition('c', 'd')],
      ),
    );

    expect(diagnosticsByCode(result, 'FL2103')).toEqual([]);
    expect(diagnosticsByCode(result, 'FL2109')).toHaveLength(1);
  });

  it('falls back deterministically to the first canonical step for reachability in a no-entry cycle', () => {
    const result = validateWorkflowSemantics(
      workflow([step('a'), step('b')], [transition('a', 'b'), transition('b', 'a')]),
    );

    expect(diagnosticsByCode(result, 'FL2106')).toHaveLength(1);
    expect(diagnosticsByCode(result, 'FL2103')).toEqual([]);
  });

  it('counts authored decision branches without evaluating their condition text', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('d', 'decision'), step('yes', 'end'), step('no', 'end')],
        [
          transition('d', 'yes', undefined, 'approved === true'),
          transition('d', 'no', undefined, 'approved === false'),
        ],
      ),
    );

    expect(diagnosticsByCode(result, 'FL2105')).toEqual([]);
  });

  it('does not call a broken outgoing target a dead-end when an authored outgoing transition exists', () => {
    const result = validateWorkflowSemantics(
      workflow([step('s', 'start')], [transition('s', 'missing')]),
    );

    expect(diagnosticsByCode(result, 'FL2003')).toHaveLength(1);
    expect(diagnosticsByCode(result, 'FL2104')).toEqual([]);
  });

  it('still recognizes declared end/outgoing contradiction when the outgoing target is broken', () => {
    const result = validateWorkflowSemantics(
      workflow([step('end', 'end')], [transition('end', 'missing')]),
    );

    expect(diagnosticsByCode(result, 'FL2003')).toHaveLength(1);
    expect(diagnosticsByCode(result, 'FL2102')).toHaveLength(1);
  });

  it('still recognizes declared start/incoming contradiction when the incoming source is broken', () => {
    const result = validateWorkflowSemantics(
      workflow([step('start', 'start')], [transition('missing', 'start')]),
    );

    expect(diagnosticsByCode(result, 'FL2002')).toHaveLength(1);
    expect(diagnosticsByCode(result, 'FL2101')).toHaveLength(1);
  });

  it('reports one FL3002 notice per self-loop in transition order', () => {
    const result = validateWorkflowSemantics(
      workflow(
        [step('a'), step('b')],
        [transition('a', 'a', 'loop-a'), transition('b', 'b', 'loop-b')],
      ),
    );

    expect(diagnosticsByCode(result, 'FL3002').map(({ path }) => path)).toEqual([
      'transitions[0]',
      'transitions[1]',
    ]);
  });
});

describe('P05 workflow graph index', () => {
  it('indexes steps and authored incident transitions by canonical identity', () => {
    const source = workflow(
      [step('a'), step('b', 'end')],
      [transition('a', 'b'), transition('a', 'missing')],
    );
    const graph = buildWorkflowGraphIndex(source);

    expect(graph.stepById.get('a')?.index).toBe(0);
    expect(graph.outgoingTransitionsByStepId.get('a')).toHaveLength(2);
    expect(graph.incomingTransitionsByStepId.get('b')).toHaveLength(1);
  });

  it('excludes broken references from traversable valid adjacency', () => {
    const source = workflow(
      [step('a'), step('b', 'end')],
      [transition('a', 'b'), transition('a', 'missing'), transition('missing', 'b')],
    );
    const graph = buildWorkflowGraphIndex(source);

    expect(graph.validTransitions).toHaveLength(1);
    expect(graph.validOutgoingTransitionsByStepId.get('a')).toHaveLength(1);
    expect(graph.validIncomingTransitionsByStepId.get('b')).toHaveLength(1);
  });

  it('derives entry and terminal candidates from valid transitions only', () => {
    const source = workflow(
      [step('a'), step('b')],
      [transition('missing', 'a'), transition('b', 'missing')],
    );
    const graph = buildWorkflowGraphIndex(source);

    expect(graph.entryCandidates.map(({ step: indexedStep }) => indexedStep.id)).toEqual([
      'a',
      'b',
    ]);
    expect(graph.terminalCandidates.map(({ step: indexedStep }) => indexedStep.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('preserves duplicate step occurrences while selecting a deterministic first identity lookup', () => {
    const graph = buildWorkflowGraphIndex(workflow([step('same'), step('same')]));

    expect(graph.stepById.get('same')?.index).toBe(0);
    expect(graph.stepOccurrencesById.get('same')?.map(({ index }) => index)).toEqual([0, 1]);
  });

  it('does not mutate the canonical workflow while building indexes', () => {
    const source = workflow([step('a'), step('b')], [transition('a', 'b')]);
    const snapshot = structuredClone(source);

    buildWorkflowGraphIndex(source);

    expect(source).toEqual(snapshot);
  });
});
