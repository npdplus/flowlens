import { describe, expect, it } from 'vitest';

import { processWorkflowText } from './processing';

const validYaml = `schemaVersion: "0.1"
name: Review flow
steps:
  - id: start
    label: Start
    type: start
  - id: review
    label: Review
    type: action
  - id: done
    label: Done
    type: end
transitions:
  - id: to-review
    source: start
    target: review
  - id: to-done
    source: review
    target: done
`;

const validJson = JSON.stringify({
  schemaVersion: '0.1',
  name: 'Review flow',
  steps: [
    { id: 'start', label: 'Start', type: 'start' },
    { id: 'review', label: 'Review' },
    { id: 'done', label: 'Done', type: 'end' },
  ],
  transitions: [
    { id: 'to-review', source: 'start', target: 'review' },
    { id: 'to-done', source: 'review', target: 'done' },
  ],
});

describe('P08 workflow processing orchestration', () => {
  it('keeps an empty editor out of the Core pipeline result surface', () => {
    expect(processWorkflowText('   ', 'yaml')).toEqual({ stage: 'empty', diagnostics: [] });
  });

  it('processes YAML through parse, structural validation, normalization, semantics, and analysis', () => {
    const result = processWorkflowText(validYaml, 'yaml');

    expect(result.stage).toBe('ready');
    expect(result.workflow?.name).toBe('Review flow');
    expect(result.workflow?.steps[1]?.type).toBe('action');
    expect(result.analysis).toMatchObject({
      stepCount: 3,
      transitionCount: 2,
      decisionStepCount: 0,
    });
    expect(result.diagramWorkflow).toBe(result.workflow);
  });

  it('processes JSON through the same approved Core path', () => {
    const result = processWorkflowText(validJson, 'json');

    expect(result.stage).toBe('ready');
    expect(result.analysis?.entry.candidateStepIds).toEqual(['start']);
    expect(result.analysis?.terminal.candidateStepIds).toEqual(['done']);
  });

  it('stops on syntax failure before structural assumptions or rendering', () => {
    const result = processWorkflowText('{"schemaVersion":', 'json');

    expect(result.stage).toBe('parse-error');
    expect(result.diagnostics[0]?.code).toBe('FL1001');
    expect(result.workflow).toBeUndefined();
    expect(result.analysis).toBeUndefined();
    expect(result.diagramWorkflow).toBeUndefined();
  });

  it('stops structurally invalid input before normalization', () => {
    const result = processWorkflowText('schemaVersion: "0.1"\nname: Missing steps', 'yaml');

    expect(result.stage).toBe('schema-error');
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'FL1102')).toBe(true);
    expect(result.workflow).toBeUndefined();
    expect(result.diagramWorkflow).toBeUndefined();
  });

  it('keeps analysis separate but clears the diagram when semantic errors exist', () => {
    const source = JSON.stringify({
      schemaVersion: '0.1',
      name: 'Broken reference',
      steps: [{ id: 'start', label: 'Start', type: 'start' }],
      transitions: [{ source: 'start', target: 'missing' }],
    });
    const result = processWorkflowText(source, 'json');

    expect(result.stage).toBe('semantic-error');
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'FL2003')).toBe(true);
    expect(result.workflow).toBeDefined();
    expect(result.analysis?.stepCount).toBe(1);
    expect(result.diagramWorkflow).toBeUndefined();
  });

  it('renders through warnings while preserving their Core severity and code', () => {
    const source = JSON.stringify({
      schemaVersion: '0.1',
      name: 'Decision warning',
      steps: [
        { id: 'choice', label: 'Choose', type: 'decision' },
        { id: 'done', label: 'Done', type: 'end' },
      ],
      transitions: [{ source: 'choice', target: 'done', condition: 'approved === true' }],
    });
    const result = processWorkflowText(source, 'json');

    expect(result.stage).toBe('ready');
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FL2105', severity: 'warning', category: 'semantic' }),
      ]),
    );
    expect(result.diagramWorkflow).toBeDefined();
  });
});
