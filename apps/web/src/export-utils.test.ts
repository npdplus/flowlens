import { describe, expect, it } from 'vitest';
import type { CanonicalWorkflow } from '@flowlens/core';

import { processWorkflowText } from './processing';
import { safeWorkflowFileStem, workflowExportFileName } from './export-utils';

const workflow = (id: string | undefined, name: string): CanonicalWorkflow => {
  const result = processWorkflowText(
    JSON.stringify({
      schemaVersion: '0.1',
      ...(id === undefined ? {} : { id }),
      name,
      steps: [{ id: 'only', label: 'Only', type: 'action' }],
      transitions: [],
    }),
    'json',
  );
  if (result.workflow === undefined) throw new Error('Expected canonical workflow fixture.');
  return result.workflow;
};

describe('P09 export filenames', () => {
  it('prefers a safe workflow id and appends the requested extension', () => {
    const candidate = workflow('purchase/approval\\..', 'Ignored name');
    expect(safeWorkflowFileStem(candidate)).toBe('purchase-approval');
    expect(workflowExportFileName(candidate, 'svg')).toBe('purchase-approval.svg');
    expect(workflowExportFileName(candidate, 'png')).toBe('purchase-approval.png');
  });

  it('uses a sanitized workflow name when no id is present', () => {
    expect(safeWorkflowFileStem(workflow(undefined, 'CI/CD: Deployment?'))).toBe(
      'ci-cd-deployment',
    );
  });

  it('uses a generic fallback for unusable or reserved filesystem names', () => {
    expect(safeWorkflowFileStem(workflow('CON', 'Reserved'))).toBe('flowlens-workflow');
    expect(safeWorkflowFileStem(workflow('////', 'Fallback'))).toBe('flowlens-workflow');
  });
});
