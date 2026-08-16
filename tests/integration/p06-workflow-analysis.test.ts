import { readFile } from 'node:fs/promises';

import {
  analyzeWorkflow,
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
  const analysis = analyzeWorkflow(canonical);
  return { stage: 'analysis' as const, parsed, structural, canonical, semantic, analysis };
};

describe('P06 parse → structural validation → normalize → semantic validation → analysis integration', () => {
  it('returns expected workflow metrics for sequential YAML', async () => {
    const result = processWorkflow(await readFile(VALID_YAML_URL, 'utf8'), 'yaml');

    expect(result.stage).toBe('analysis');
    if (result.stage === 'analysis') {
      expect(result.semantic.isValid).toBe(true);
      expect(result.analysis).toMatchObject({
        stepCount: 3,
        transitionCount: 2,
        decisionStepCount: 0,
        entry: {
          candidateStepIds: ['start'],
          candidateCount: 1,
          explicitStartStepIds: ['start'],
          explicitStartCount: 1,
        },
        terminal: {
          candidateStepIds: ['end'],
          candidateCount: 1,
          explicitEndStepIds: ['end'],
          explicitEndCount: 1,
        },
        branching: { stepIds: [], stepCount: 0, maximumOutgoingTransitionCount: 1 },
        cycles: { hasDirectedCycle: false, nonSelfCycleGroupCount: 0 },
        components: { count: 1, largestSize: 3 },
      });
    }
  });

  it('returns equivalent analysis for equivalent JSON and YAML', async () => {
    const jsonResult = processWorkflow(await fixtureSource('valid-sequential'), 'json');
    const yamlResult = processWorkflow(await readFile(VALID_YAML_URL, 'utf8'), 'yaml');

    expect(jsonResult.stage).toBe('analysis');
    expect(yamlResult.stage).toBe('analysis');
    if (jsonResult.stage === 'analysis' && yamlResult.stage === 'analysis') {
      expect(yamlResult.canonical).toEqual(jsonResult.canonical);
      expect(yamlResult.analysis).toEqual(jsonResult.analysis);
    }
  });

  it('reports declared-decision and topological-branching facts for a branching workflow', async () => {
    const result = processWorkflow(await fixtureSource('valid-decision'), 'json');

    expect(result.stage).toBe('analysis');
    if (result.stage === 'analysis') {
      expect(result.semantic.isValid).toBe(true);
      expect(result.analysis.decisionStepCount).toBe(1);
      expect(result.analysis.branching).toEqual({
        stepIds: ['decision'],
        stepCount: 1,
        maximumOutgoingTransitionCount: 2,
      });
      expect(result.analysis.terminal.candidateStepIds).toEqual(['yes', 'no']);
    }
  });

  it('terminates safely and returns deterministic cycle analysis for a cyclic workflow', async () => {
    const source = await fixtureSource('multi-node-cycle');
    const first = processWorkflow(source, 'json');
    const second = processWorkflow(source, 'json');

    expect(first.stage).toBe('analysis');
    expect(second.stage).toBe('analysis');
    if (first.stage === 'analysis' && second.stage === 'analysis') {
      expect(first.semantic.diagnostics).toContainEqual(
        expect.objectContaining({ code: 'FL3001', severity: 'info', category: 'analysis' }),
      );
      expect(first.analysis.cycles).toEqual({
        hasDirectedCycle: true,
        nonSelfCycleGroups: [{ stepIds: ['a', 'b', 'c'] }],
        nonSelfCycleGroupCount: 1,
        cyclicStepIds: ['a', 'b', 'c'],
      });
      expect(second.analysis).toEqual(first.analysis);
    }
  });

  it('keeps disconnected analysis consistent with P05 semantic diagnostics', async () => {
    const result = processWorkflow(await fixtureSource('disconnected-component'), 'json');

    expect(result.stage).toBe('analysis');
    if (result.stage === 'analysis') {
      expect(result.semantic.diagnostics).toContainEqual(
        expect.objectContaining({ code: 'FL2107', category: 'semantic' }),
      );
      expect(result.semantic.diagnostics).toContainEqual(
        expect.objectContaining({ code: 'FL2109', category: 'semantic' }),
      );
      expect(result.analysis.entry.candidateStepIds).toEqual(['a', 'c']);
      expect(result.analysis.components).toEqual({
        stepIdGroups: [
          ['a', 'b'],
          ['c', 'd'],
        ],
        count: 2,
        largestSize: 2,
      });
    }
  });

  it('does not let structurally invalid input reach normalization, semantic validation, or analysis', () => {
    const result = processWorkflow(
      JSON.stringify({ schemaVersion: '0.1', name: 'Invalid', steps: [], transitions: [] }),
      'json',
    );

    expect(result.stage).toBe('structural');
    if (result.stage === 'structural') {
      expect(result.structural.success).toBe(false);
      expect('canonical' in result).toBe(false);
      expect('semantic' in result).toBe(false);
      expect('analysis' in result).toBe(false);
    }
  });
});
