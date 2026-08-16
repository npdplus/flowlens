import { readFile } from 'node:fs/promises';

import {
  normalizeWorkflowDefinition,
  parseWorkflowText,
  validateWorkflowDefinition,
} from '@flowlens/core';
import { describe, expect, it } from 'vitest';

const JSON_FIXTURE_URL = new URL('../fixtures/p03/equivalent-workflow.json', import.meta.url);
const YAML_FIXTURE_URL = new URL('../fixtures/p03/equivalent-workflow.yaml', import.meta.url);

const validateGoldenFixture = (data: unknown) => {
  const result = validateWorkflowDefinition(data);
  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error('Golden fixture must be structurally valid.');
  }
  return result.definition;
};

describe('P03 parser and normalization integration through the P04 gate', () => {
  it('normalizes equivalent JSON and YAML fixtures to identical canonical semantics', async () => {
    const [jsonSource, yamlSource] = await Promise.all([
      readFile(JSON_FIXTURE_URL, 'utf8'),
      readFile(YAML_FIXTURE_URL, 'utf8'),
    ]);

    const jsonResult = parseWorkflowText(jsonSource, 'json');
    const yamlResult = parseWorkflowText(yamlSource, 'yaml');

    expect(jsonResult.success).toBe(true);
    expect(yamlResult.success).toBe(true);
    if (!jsonResult.success || !yamlResult.success) {
      throw new Error('Golden fixtures must be syntax-valid.');
    }

    const jsonCanonical = normalizeWorkflowDefinition(validateGoldenFixture(jsonResult.data));
    const yamlCanonical = normalizeWorkflowDefinition(validateGoldenFixture(yamlResult.data));

    expect(jsonCanonical).toEqual(yamlCanonical);
    expect(jsonCanonical.steps[1]?.type).toBe('action');
    expect(jsonCanonical.transitions[0]?.sourceDefinedId).toBe('to-review');
    expect(jsonCanonical.transitions[1]?.internalId).toBe('transition:6:review:4:done:0');
    expect(jsonCanonical.transitions[2]?.internalId).toBe('transition:6:review:4:done:1');
  });

  it('keeps syntax-valid non-workflow input outside the normalizer boundary', () => {
    const scalarResult = parseWorkflowText('42', 'json');
    const arrayResult = parseWorkflowText('- one\n- two\n', 'yaml');

    expect(scalarResult).toEqual({ success: true, format: 'json', data: 42 });
    expect(arrayResult).toEqual({ success: true, format: 'yaml', data: ['one', 'two'] });

    if (!scalarResult.success || !arrayResult.success) {
      throw new Error('Boundary fixtures must be syntax-valid.');
    }
    expect(validateWorkflowDefinition(scalarResult.data).success).toBe(false);
    expect(validateWorkflowDefinition(arrayResult.data).success).toBe(false);
  });
});
