import { readFile } from 'node:fs/promises';

import {
  normalizeWorkflowDefinition,
  parseWorkflowText,
  validateWorkflowDefinition,
  validateWorkflowSemantics,
  type InputFormat,
} from '@flowlens/core';
import { describe, expect, it } from 'vitest';

const FIXTURE_CATALOG_URL = new URL('../fixtures/p05/semantic-workflows.json', import.meta.url);
const VALID_YAML_URL = new URL('../fixtures/p05/valid-sequential.yaml', import.meta.url);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fixtureSource = async (name: string): Promise<string> => {
  const catalogText = await readFile(FIXTURE_CATALOG_URL, 'utf8');
  const catalog: unknown = JSON.parse(catalogText);
  if (!isRecord(catalog) || !(name in catalog)) {
    throw new Error(`Missing P05 fixture: ${name}`);
  }
  return JSON.stringify(catalog[name]);
};

const processWorkflow = (source: string, format: InputFormat) => {
  const parsed = parseWorkflowText(source, format);
  if (!parsed.success) {
    return { stage: 'parse' as const, parsed };
  }

  const structural = validateWorkflowDefinition(parsed.data);
  if (!structural.success) {
    return { stage: 'structural' as const, parsed, structural };
  }

  const canonical = normalizeWorkflowDefinition(structural.definition);
  const semantic = validateWorkflowSemantics(canonical);
  return { stage: 'semantic' as const, parsed, structural, canonical, semantic };
};

describe('P05 parser → validator → normalizer → semantic validator integration', () => {
  it('allows valid sequential JSON to reach P05 with no semantic diagnostic', async () => {
    const result = processWorkflow(await fixtureSource('valid-sequential'), 'json');

    expect(result.stage).toBe('semantic');
    if (result.stage === 'semantic') {
      expect(result.semantic.isValid).toBe(true);
      expect(result.semantic.diagnostics).toEqual([]);
    }
  });

  it('allows equivalent valid YAML to produce equivalent semantic results', async () => {
    const jsonResult = processWorkflow(await fixtureSource('valid-sequential'), 'json');
    const yamlResult = processWorkflow(await readFile(VALID_YAML_URL, 'utf8'), 'yaml');

    expect(jsonResult.stage).toBe('semantic');
    expect(yamlResult.stage).toBe('semantic');
    if (jsonResult.stage === 'semantic' && yamlResult.stage === 'semantic') {
      expect(yamlResult.canonical).toEqual(jsonResult.canonical);
      expect(yamlResult.semantic).toEqual(jsonResult.semantic);
    }
  });

  it('keeps structurally invalid parsed input out of normalization and P05', () => {
    const result = processWorkflow(
      JSON.stringify({ schemaVersion: '0.1', steps: [], transitions: [] }),
      'json',
    );

    expect(result.stage).toBe('structural');
    if (result.stage === 'structural') {
      expect(result.structural.success).toBe(false);
      expect('canonical' in result).toBe(false);
      expect('semantic' in result).toBe(false);
    }
  });

  it('keeps unsupported schema versions out of P05', () => {
    const result = processWorkflow(
      JSON.stringify({
        schemaVersion: '9.9',
        name: 'Unsupported',
        steps: [{ id: 'only', label: 'Only' }],
        transitions: [],
      }),
      'json',
    );

    expect(result.stage).toBe('structural');
    if (result.stage === 'structural') {
      expect(result.structural.diagnostics).toContainEqual(
        expect.objectContaining({ code: 'FL1101', path: 'schemaVersion' }),
      );
      expect('semantic' in result).toBe(false);
    }
  });

  it('lets duplicate step IDs pass P04 and fail P05 with FL2001', async () => {
    const result = processWorkflow(await fixtureSource('duplicate-step-id'), 'json');

    expect(result.stage).toBe('semantic');
    if (result.stage === 'semantic') {
      expect(result.structural.success).toBe(true);
      expect(result.semantic.isValid).toBe(false);
      expect(result.semantic.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'FL2001',
          severity: 'error',
          category: 'semantic',
          path: 'steps[1].id',
        }),
      );
    }
  });

  it('lets duplicate authored transition IDs pass P04 and fail P05 with FL2004', async () => {
    const result = processWorkflow(await fixtureSource('duplicate-transition-id'), 'json');

    expect(result.stage).toBe('semantic');
    if (result.stage === 'semantic') {
      expect(result.semantic.isValid).toBe(false);
      expect(result.semantic.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'FL2004',
          severity: 'error',
          category: 'semantic',
          path: 'transitions[1].id',
        }),
      );
    }
  });

  it('detects unknown transition source only after normalization/P05', async () => {
    const result = processWorkflow(await fixtureSource('unknown-source'), 'json');

    expect(result.stage).toBe('semantic');
    if (result.stage === 'semantic') {
      expect(result.structural.diagnostics).toEqual([]);
      expect(result.semantic.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'FL2002',
          severity: 'error',
          category: 'semantic',
          path: 'transitions[0].source',
        }),
      );
    }
  });

  it('detects unknown transition target only after normalization/P05', async () => {
    const result = processWorkflow(await fixtureSource('unknown-target'), 'json');

    expect(result.stage).toBe('semantic');
    if (result.stage === 'semantic') {
      expect(result.structural.diagnostics).toEqual([]);
      expect(result.semantic.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'FL2003',
          severity: 'error',
          category: 'semantic',
          path: 'transitions[0].target',
        }),
      );
    }
  });

  it('detects an unreachable step after canonicalization', async () => {
    const result = processWorkflow(await fixtureSource('unreachable-step'), 'json');

    expect(result.stage).toBe('semantic');
    if (result.stage === 'semantic') {
      expect(result.semantic.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'FL2103',
          severity: 'warning',
          category: 'semantic',
          path: 'steps[2]',
        }),
      );
    }
  });

  it('accepts a structurally valid branching decision with only expected semantic output', async () => {
    const result = processWorkflow(await fixtureSource('valid-decision'), 'json');

    expect(result.stage).toBe('semantic');
    if (result.stage === 'semantic') {
      expect(result.semantic.diagnostics).toEqual([]);
      expect(result.semantic.isValid).toBe(true);
    }
  });

  it('terminates safely on a cyclic workflow and keeps FL3001 info/analysis', async () => {
    const result = processWorkflow(await fixtureSource('simple-cycle'), 'json');

    expect(result.stage).toBe('semantic');
    if (result.stage === 'semantic') {
      expect(result.semantic.diagnostics).toContainEqual(
        expect.objectContaining({ code: 'FL3001', severity: 'info', category: 'analysis' }),
      );
      expect(result.semantic.isValid).toBe(true);
    }
  });

  it('terminates safely on a self-loop and keeps FL3002 info/analysis', async () => {
    const result = processWorkflow(await fixtureSource('self-loop'), 'json');

    expect(result.stage).toBe('semantic');
    if (result.stage === 'semantic') {
      expect(result.semantic.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'FL3002',
          severity: 'info',
          category: 'analysis',
          path: 'transitions[0]',
        }),
      );
      expect(result.semantic.isValid).toBe(true);
    }
  });

  it('produces equivalent P05 diagnostics for JSON/YAML-equivalent definitions', async () => {
    const jsonResult = processWorkflow(await fixtureSource('valid-sequential'), 'json');
    const yamlResult = processWorkflow(await readFile(VALID_YAML_URL, 'utf8'), 'yaml');

    expect(jsonResult.stage).toBe('semantic');
    expect(yamlResult.stage).toBe('semantic');
    if (jsonResult.stage === 'semantic' && yamlResult.stage === 'semantic') {
      expect(jsonResult.semantic.diagnostics).toEqual(yamlResult.semantic.diagnostics);
    }
  });

  it('keeps structural FL1107 warnings out of canonical semantic fields and graph meaning', () => {
    const result = processWorkflow(
      JSON.stringify({
        schemaVersion: '0.1',
        name: 'Unknown Structural Field',
        unknownTopLevel: 'ignored',
        steps: [
          { id: 'start', label: 'Start', type: 'start', unknownStepField: true },
          { id: 'end', label: 'End', type: 'end' },
        ],
        transitions: [{ source: 'start', target: 'end', unknownTransitionField: 1 }],
      }),
      'json',
    );

    expect(result.stage).toBe('semantic');
    if (result.stage === 'semantic') {
      expect(result.structural.diagnostics.map(({ code }) => code)).toEqual([
        'FL1107',
        'FL1107',
        'FL1107',
      ]);
      expect(result.semantic.diagnostics).toEqual([]);
      expect(result.canonical).not.toHaveProperty('unknownTopLevel');
      expect(result.canonical.steps[0]).not.toHaveProperty('unknownStepField');
      expect(result.canonical.transitions[0]).not.toHaveProperty('unknownTransitionField');
    }
  });
});
