import { describe, expect, it } from 'vitest';

import { parseWorkflowText } from '../index';

describe('parseWorkflowText', () => {
  it('uses explicit JSON format selection', () => {
    expect(parseWorkflowText('{"value":1}', 'json')).toEqual({
      success: true,
      format: 'json',
      data: { value: 1 },
    });
  });

  it('uses explicit YAML format selection', () => {
    expect(parseWorkflowText('value: 1\n', 'yaml')).toEqual({
      success: true,
      format: 'yaml',
      data: { value: 1 },
    });
  });

  it('does not reinterpret syntax-valid structurally invalid input as a workflow', () => {
    expect(parseWorkflowText('[]', 'json')).toEqual({
      success: true,
      format: 'json',
      data: [],
    });
  });
});
