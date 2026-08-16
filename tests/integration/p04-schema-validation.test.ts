import { readFile } from 'node:fs/promises';

import {
  normalizeWorkflowDefinition,
  parseWorkflowText,
  validateWorkflowDefinition,
  type InputFormat,
} from '@flowlens/core';
import { describe, expect, it } from 'vitest';

const P03_JSON_URL = new URL('../fixtures/p03/equivalent-workflow.json', import.meta.url);
const P03_YAML_URL = new URL('../fixtures/p03/equivalent-workflow.yaml', import.meta.url);
const MINIMAL_VALID_URL = new URL('../fixtures/p04/minimal-valid.json', import.meta.url);
const MISSING_NAME_URL = new URL('../fixtures/p04/missing-name.json', import.meta.url);
const UNSUPPORTED_VERSION_URL = new URL(
  '../fixtures/p04/unsupported-schema-version.json',
  import.meta.url,
);
const UNKNOWN_FIELD_URL = new URL('../fixtures/p04/unknown-field.json', import.meta.url);

const parseAndValidate = (source: string, format: InputFormat) => {
  const parsed = parseWorkflowText(source, format);
  if (!parsed.success) {
    return { stage: 'parse' as const, parsed };
  }

  const validation = validateWorkflowDefinition(parsed.data);
  if (!validation.success) {
    return { stage: 'validation' as const, parsed, validation };
  }

  return {
    stage: 'canonical' as const,
    parsed,
    validation,
    canonical: normalizeWorkflowDefinition(validation.definition),
  };
};

describe('P04 parser → validator → normalizer integration', () => {
  it('allows valid JSON to reach the canonical workflow model', async () => {
    const source = await readFile(P03_JSON_URL, 'utf8');
    const result = parseAndValidate(source, 'json');

    expect(result.stage).toBe('canonical');
    if (result.stage === 'canonical') {
      expect(result.canonical.schemaVersion).toBe('0.1');
      expect(result.canonical.name).toBe('Golden Equivalence');
    }
  });

  it('allows valid YAML to reach the canonical workflow model', async () => {
    const source = await readFile(P03_YAML_URL, 'utf8');
    const result = parseAndValidate(source, 'yaml');

    expect(result.stage).toBe('canonical');
    if (result.stage === 'canonical') {
      expect(result.canonical.steps).toHaveLength(3);
      expect(result.canonical.transitions).toHaveLength(3);
    }
  });

  it('blocks structurally invalid parsed input before normalization', async () => {
    const source = await readFile(MISSING_NAME_URL, 'utf8');
    const result = parseAndValidate(source, 'json');

    expect(result.stage).toBe('validation');
    if (result.stage === 'validation') {
      expect(result.validation.diagnostics).toContainEqual(
        expect.objectContaining({ code: 'FL1102', path: 'name', severity: 'error' }),
      );
      expect('canonical' in result).toBe(false);
    }
  });

  it('keeps parse failures out of structural validation', () => {
    const result = parseAndValidate('{ invalid json', 'json');

    expect(result.stage).toBe('parse');
    if (result.stage === 'parse') {
      expect(result.parsed.success).toBe(false);
      if (!result.parsed.success) {
        expect(result.parsed.code).toBe('FL1001');
      }
      expect('validation' in result).toBe(false);
    }
  });

  it('blocks unsupported schema versions before canonical normalization', async () => {
    const source = await readFile(UNSUPPORTED_VERSION_URL, 'utf8');
    const result = parseAndValidate(source, 'json');

    expect(result.stage).toBe('validation');
    if (result.stage === 'validation') {
      expect(result.validation.diagnostics).toContainEqual(
        expect.objectContaining({ code: 'FL1101', path: 'schemaVersion' }),
      );
      expect('canonical' in result).toBe(false);
    }
  });

  it('defaults an omitted step type only when P03 normalization runs', async () => {
    const source = await readFile(MINIMAL_VALID_URL, 'utf8');
    const parsed = parseWorkflowText(source, 'json');
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error('Minimal fixture must parse.');
    }

    const validation = validateWorkflowDefinition(parsed.data);
    expect(validation.success).toBe(true);
    if (!validation.success) {
      throw new Error('Minimal fixture must validate.');
    }

    expect(validation.definition.steps[0]?.type).toBeUndefined();
    expect(normalizeWorkflowDefinition(validation.definition).steps[0]?.type).toBe('action');
  });

  it('keeps FL1107 warnings non-blocking and out of canonical semantics', async () => {
    const source = await readFile(UNKNOWN_FIELD_URL, 'utf8');
    const result = parseAndValidate(source, 'json');

    expect(result.stage).toBe('canonical');
    if (result.stage === 'canonical') {
      expect(result.validation.diagnostics).toHaveLength(3);
      expect(
        result.validation.diagnostics.every((diagnostic) => diagnostic.code === 'FL1107'),
      ).toBe(true);
      expect(result.canonical).toEqual({
        schemaVersion: '0.1',
        name: 'Unknown Fields',
        steps: [{ id: 'start', label: 'Start', type: 'action', metadata: {} }],
        transitions: [
          {
            internalId: 'transition:5:start:5:start:0',
            sourceStepId: 'start',
            targetStepId: 'start',
            metadata: {},
          },
        ],
        metadata: {},
      });
    }
  });

  it('keeps equivalent JSON and YAML canonically equivalent after validation', async () => {
    const [jsonSource, yamlSource] = await Promise.all([
      readFile(P03_JSON_URL, 'utf8'),
      readFile(P03_YAML_URL, 'utf8'),
    ]);
    const jsonResult = parseAndValidate(jsonSource, 'json');
    const yamlResult = parseAndValidate(yamlSource, 'yaml');

    expect(jsonResult.stage).toBe('canonical');
    expect(yamlResult.stage).toBe('canonical');
    if (jsonResult.stage === 'canonical' && yamlResult.stage === 'canonical') {
      expect(jsonResult.canonical).toEqual(yamlResult.canonical);
    }
  });
});
