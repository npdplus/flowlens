import { describe, expect, it } from 'vitest';

import {
  normalizeWorkflowDefinition,
  parseJson,
  parseYaml,
  validateWorkflowDefinition,
  type StructuralDiagnosticCode,
  type StructuralValidationResult,
} from '../index';

const createValidDefinition = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  schemaVersion: '0.1',
  name: 'Validation Test',
  steps: [{ id: 'start', label: 'Start' }],
  transitions: [],
  ...overrides,
});

const expectDiagnostic = (
  result: StructuralValidationResult,
  code: StructuralDiagnosticCode,
  path?: string,
  severity: 'error' | 'warning' = 'error',
): void => {
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      severity,
      category: 'schema',
      ...(path === undefined ? {} : { path }),
    }),
  );
};

describe('validateWorkflowDefinition', () => {
  it('accepts a minimal valid definition', () => {
    const result = validateWorkflowDefinition(createValidDefinition());

    expect(result.success).toBe(true);
    expect(result.diagnostics).toEqual([]);
    if (result.success) {
      expect(result.definition).toEqual(createValidDefinition());
    }
  });

  it('accepts JSON parser output after syntax parsing', () => {
    const parsed = parseJson(JSON.stringify(createValidDefinition()));
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error('Fixture must parse.');
    }

    expect(validateWorkflowDefinition(parsed.data).success).toBe(true);
  });

  it('accepts YAML parser output after syntax parsing', () => {
    const parsed = parseYaml(
      `schemaVersion: "0.1"\nname: YAML Valid\nsteps:\n  - id: start\n    label: Start\ntransitions: []\n`,
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error('Fixture must parse.');
    }

    expect(validateWorkflowDefinition(parsed.data).success).toBe(true);
  });

  it('rejects a non-workflow scalar with FL1103', () => {
    const result = validateWorkflowDefinition(42);

    expectDiagnostic(result, 'FL1103');
  });

  it('reports missing schemaVersion as FL1102', () => {
    const input = createValidDefinition();
    delete input.schemaVersion;
    const result = validateWorkflowDefinition(input);

    expectDiagnostic(result, 'FL1102', 'schemaVersion');
  });

  it('reports non-string schemaVersion as FL1103', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ schemaVersion: 1 }));

    expectDiagnostic(result, 'FL1103', 'schemaVersion');
  });

  it('reports unsupported schemaVersion as FL1101', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ schemaVersion: '1.0' }));

    expectDiagnostic(result, 'FL1101', 'schemaVersion');
  });

  it('reports missing workflow name as FL1102', () => {
    const input = createValidDefinition();
    delete input.name;
    const result = validateWorkflowDefinition(input);

    expectDiagnostic(result, 'FL1102', 'name');
  });

  it('reports empty workflow name as FL1104', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ name: '' }));

    expectDiagnostic(result, 'FL1104', 'name');
  });

  it('reports an empty optional workflow id as FL1104', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ id: '' }));

    expectDiagnostic(result, 'FL1104', 'id');
  });

  it('reports an invalid workflow description type as FL1103', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ description: 12 }));

    expectDiagnostic(result, 'FL1103', 'description');
  });

  it('reports missing steps as FL1102', () => {
    const input = createValidDefinition();
    delete input.steps;
    const result = validateWorkflowDefinition(input);

    expectDiagnostic(result, 'FL1102', 'steps');
  });

  it('reports a wrong steps collection type as FL1103', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ steps: {} }));

    expectDiagnostic(result, 'FL1103', 'steps');
  });

  it('reports an empty steps collection as FL1105', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ steps: [] }));

    expectDiagnostic(result, 'FL1105', 'steps');
  });

  it('reports a malformed step as FL1103', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ steps: [null] }));

    expectDiagnostic(result, 'FL1103', 'steps[0]');
  });

  it('reports a missing step id as FL1102', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ steps: [{ label: 'Missing ID' }] }),
    );

    expectDiagnostic(result, 'FL1102', 'steps[0].id');
  });

  it('reports an empty step id as FL1104', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ steps: [{ id: '', label: 'Empty ID' }] }),
    );

    expectDiagnostic(result, 'FL1104', 'steps[0].id');
  });

  it('reports a missing step label as FL1102', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ steps: [{ id: 'start' }] }));

    expectDiagnostic(result, 'FL1102', 'steps[0].label');
  });

  it('reports an empty step label as FL1104', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ steps: [{ id: 'start', label: '' }] }),
    );

    expectDiagnostic(result, 'FL1104', 'steps[0].label');
  });

  it('reports an unsupported step type as FL1104', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ steps: [{ id: 'start', label: 'Start', type: 'trigger' }] }),
    );

    expectDiagnostic(result, 'FL1104', 'steps[0].type');
  });

  it('reports an unsupported step status as FL1104', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ steps: [{ id: 'start', label: 'Start', status: 'complete' }] }),
    );

    expectDiagnostic(result, 'FL1104', 'steps[0].status');
  });

  it('reports an invalid step description type as FL1103', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ steps: [{ id: 'start', label: 'Start', description: true }] }),
    );

    expectDiagnostic(result, 'FL1103', 'steps[0].description');
  });

  it('reports missing transitions as FL1102', () => {
    const input = createValidDefinition();
    delete input.transitions;
    const result = validateWorkflowDefinition(input);

    expectDiagnostic(result, 'FL1102', 'transitions');
  });

  it('reports a wrong transitions collection type as FL1103', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ transitions: {} }));

    expectDiagnostic(result, 'FL1103', 'transitions');
  });

  it('reports a malformed transition as FL1103', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ transitions: [null] }));

    expectDiagnostic(result, 'FL1103', 'transitions[0]');
  });

  it('reports a missing transition source as FL1102', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ transitions: [{ target: 'start' }] }),
    );

    expectDiagnostic(result, 'FL1102', 'transitions[0].source');
  });

  it('reports a missing transition target as FL1102', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ transitions: [{ source: 'start' }] }),
    );

    expectDiagnostic(result, 'FL1102', 'transitions[0].target');
  });

  it('reports an empty transition source as FL1104', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ transitions: [{ source: '', target: 'start' }] }),
    );

    expectDiagnostic(result, 'FL1104', 'transitions[0].source');
  });

  it('reports an empty transition target as FL1104', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ transitions: [{ source: 'start', target: '' }] }),
    );

    expectDiagnostic(result, 'FL1104', 'transitions[0].target');
  });

  it('reports an empty optional transition id as FL1104', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ transitions: [{ id: '', source: 'start', target: 'start' }] }),
    );

    expectDiagnostic(result, 'FL1104', 'transitions[0].id');
  });

  it('reports an invalid transition label type as FL1103', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ transitions: [{ source: 'start', target: 'start', label: 1 }] }),
    );

    expectDiagnostic(result, 'FL1103', 'transitions[0].label');
  });

  it('reports an invalid transition condition type as FL1103', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({
        transitions: [{ source: 'start', target: 'start', condition: true }],
      }),
    );

    expectDiagnostic(result, 'FL1103', 'transitions[0].condition');
  });

  it('accepts nested JSON-compatible metadata', () => {
    const metadata = {
      owner: 'labs',
      enabled: true,
      count: 2,
      empty: null,
      values: ['one', 2, false, null, { nested: ['value'] }],
    };
    const result = validateWorkflowDefinition(
      createValidDefinition({
        metadata,
        steps: [{ id: 'start', label: 'Start', metadata }],
        transitions: [{ source: 'start', target: 'start', metadata }],
      }),
    );

    expect(result.success).toBe(true);
  });

  it('reports a non-object metadata field as FL1106', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ metadata: [] }));

    expectDiagnostic(result, 'FL1106', 'metadata');
  });

  it('reports executable metadata values as FL1106', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ metadata: { callback: () => 'unsafe' } }),
    );

    expectDiagnostic(result, 'FL1106', 'metadata.callback');
  });

  it('reports non-finite metadata numbers as FL1106', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ metadata: { threshold: Number.NaN } }),
    );

    expectDiagnostic(result, 'FL1106', 'metadata.threshold');
  });

  it('reports class instances nested in metadata as FL1106', () => {
    class Box {
      readonly value = 1;
    }
    const result = validateWorkflowDefinition(
      createValidDefinition({ metadata: { box: new Box() } }),
    );

    expectDiagnostic(result, 'FL1106', 'metadata.box');
  });

  it('fails safely on cyclic programmatic metadata', () => {
    const metadata: Record<string, unknown> = {};
    metadata.self = metadata;
    const result = validateWorkflowDefinition(createValidDefinition({ metadata }));

    expectDiagnostic(result, 'FL1106', 'metadata.self');
  });

  it('handles deeply nested metadata without recursive traversal overflow', () => {
    let nested: Record<string, unknown> = { leaf: 'safe' };
    for (let depth = 0; depth < 3_000; depth += 1) {
      nested = { next: nested };
    }

    expect(validateWorkflowDefinition(createValidDefinition({ metadata: nested })).success).toBe(
      true,
    );
  });

  it('allows repeated non-cyclic metadata references', () => {
    const shared = { value: 'shared' };
    const result = validateWorkflowDefinition(
      createValidDefinition({ metadata: { left: shared, right: shared } }),
    );

    expect(result.success).toBe(true);
  });

  it('rejects metadata accessors without executing them', () => {
    let executions = 0;
    const metadata = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(metadata, 'danger', {
      enumerable: true,
      get: () => {
        executions += 1;
        return 'unsafe';
      },
    });

    const result = validateWorkflowDefinition(createValidDefinition({ metadata }));

    expectDiagnostic(result, 'FL1106', 'metadata.danger');
    expect(executions).toBe(0);
  });

  it('reports unknown workflow fields as FL1107 warnings', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ extra: 'ignored' }));

    expectDiagnostic(result, 'FL1107', 'extra', 'warning');
    expect(result.success).toBe(true);
  });

  it('reports unknown step fields as FL1107 warnings', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({ steps: [{ id: 'start', label: 'Start', shape: 'ignored' }] }),
    );

    expectDiagnostic(result, 'FL1107', 'steps[0].shape', 'warning');
    expect(result.success).toBe(true);
  });

  it('reports unknown transition fields as FL1107 warnings', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({
        transitions: [{ source: 'start', target: 'start', rendererStyle: 'ignored' }],
      }),
    );

    expectDiagnostic(result, 'FL1107', 'transitions[0].rendererStyle', 'warning');
    expect(result.success).toBe(true);
  });

  it('strips unknown fields from validated native output instead of promoting semantics', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({
        owner: 'ignored',
        steps: [{ id: 'start', label: 'Start', shape: 'ignored' }],
        transitions: [{ source: 'start', target: 'start', rendererStyle: 'ignored' }],
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.definition).toEqual({
        schemaVersion: '0.1',
        name: 'Validation Test',
        steps: [{ id: 'start', label: 'Start' }],
        transitions: [{ source: 'start', target: 'start' }],
      });
    }
  });

  it('accumulates multiple independent schema problems', () => {
    const result = validateWorkflowDefinition({
      name: '',
      steps: [{ label: 'Missing ID', status: 'complete' }],
      transitions: [{ source: 42 }],
      metadata: [],
    });

    expect(result.success).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(6);
    expectDiagnostic(result, 'FL1102', 'schemaVersion');
    expectDiagnostic(result, 'FL1104', 'name');
    expectDiagnostic(result, 'FL1102', 'steps[0].id');
    expectDiagnostic(result, 'FL1104', 'steps[0].status');
    expectDiagnostic(result, 'FL1103', 'transitions[0].source');
    expectDiagnostic(result, 'FL1102', 'transitions[0].target');
    expectDiagnostic(result, 'FL1106', 'metadata');
  });

  it('orders diagnostics deterministically', () => {
    const input = {
      name: '',
      extra: true,
      steps: [
        { id: 'one', label: 'One' },
        { label: '', status: 'complete', extraStep: true },
      ],
      transitions: [{ source: 1 }],
    };

    const first = validateWorkflowDefinition(input).diagnostics;
    const second = validateWorkflowDefinition(input).diagnostics;

    expect(first).toEqual(second);
  });

  it('keeps warning-only definitions structurally valid', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ extension: 'ignored' }));

    expect(result.success).toBe(true);
    expect(result.diagnostics.every((diagnostic) => diagnostic.severity === 'warning')).toBe(true);
  });

  it('does not expose validated native output when structural errors exist', () => {
    const result = validateWorkflowDefinition(createValidDefinition({ name: '' }));

    expect(result.success).toBe(false);
    expect('definition' in result).toBe(false);
  });

  it('does not diagnose duplicate step ids in P04', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({
        steps: [
          { id: 'duplicate', label: 'One' },
          { id: 'duplicate', label: 'Two' },
        ],
      }),
    );

    expect(result.success).toBe(true);
    expect(result.diagnostics.map((diagnostic): string => diagnostic.code)).not.toContain('FL2001');
  });

  it('does not diagnose duplicate explicit transition ids in P04', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({
        transitions: [
          { id: 'duplicate', source: 'start', target: 'start' },
          { id: 'duplicate', source: 'start', target: 'start' },
        ],
      }),
    );

    expect(result.success).toBe(true);
    expect(result.diagnostics.map((diagnostic): string => diagnostic.code)).not.toContain('FL2004');
  });

  it('does not diagnose unknown transition references in P04', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({
        transitions: [{ source: 'missing-source', target: 'missing-target' }],
      }),
    );

    expect(result.success).toBe(true);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code.startsWith('FL200'))).toBe(
      false,
    );
  });

  it('leaves an omitted step type absent until P03 normalization', () => {
    const result = validateWorkflowDefinition(createValidDefinition());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.definition.steps[0]?.type).toBeUndefined();
      expect(normalizeWorkflowDefinition(result.definition).steps[0]?.type).toBe('action');
    }
  });

  it('preserves conditions as inert strings', () => {
    const condition = 'globalThis.flowLensCompromised = true';
    const result = validateWorkflowDefinition(
      createValidDefinition({ transitions: [{ source: 'start', target: 'start', condition }] }),
    );

    expect(result.success).toBe(true);
    expect((globalThis as { flowLensCompromised?: boolean }).flowLensCompromised).toBeUndefined();
    if (result.success) {
      expect(result.definition.transitions[0]?.condition).toBe(condition);
    }
  });

  it('preserves script-like metadata strings as inert data', () => {
    const payload = '<script>globalThis.flowLensCompromised = true</script>';
    const result = validateWorkflowDefinition(createValidDefinition({ metadata: { payload } }));

    expect(result.success).toBe(true);
    expect((globalThis as { flowLensCompromised?: boolean }).flowLensCompromised).toBeUndefined();
    if (result.success) {
      expect(result.definition.metadata?.payload).toBe(payload);
    }
  });

  it('does not mutate a frozen caller input', () => {
    const step = Object.freeze({ id: 'start', label: 'Start' });
    const input = Object.freeze({
      schemaVersion: '0.1',
      name: 'Frozen',
      steps: Object.freeze([step]),
      transitions: Object.freeze([]),
    });
    const before = JSON.stringify(input);

    const result = validateWorkflowDefinition(input);

    expect(result.success).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(input)).toBe(true);
  });

  it('accepts all supported step types and statuses', () => {
    const result = validateWorkflowDefinition(
      createValidDefinition({
        steps: [
          { id: 'start', label: 'Start', type: 'start', status: 'pending' },
          { id: 'action', label: 'Action', type: 'action', status: 'active' },
          { id: 'decision', label: 'Decision', type: 'decision', status: 'warning' },
          { id: 'success', label: 'Success', type: 'action', status: 'success' },
          { id: 'failed', label: 'Failed', type: 'action', status: 'failed' },
          { id: 'end', label: 'End', type: 'end', status: 'skipped' },
        ],
      }),
    );

    expect(result.success).toBe(true);
  });

  it('accepts a reasonably large workflow with linear structural processing', () => {
    const steps = Array.from({ length: 500 }, (_, index) => ({
      id: `step-${index}`,
      label: `Step ${index}`,
    }));
    const transitions = Array.from({ length: 499 }, (_, index) => ({
      source: `step-${index}`,
      target: `step-${index + 1}`,
    }));

    expect(validateWorkflowDefinition(createValidDefinition({ steps, transitions })).success).toBe(
      true,
    );
  });
});
