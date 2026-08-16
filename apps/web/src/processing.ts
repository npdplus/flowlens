import {
  analyzeWorkflow,
  normalizeWorkflowDefinition,
  parseWorkflowText,
  validateWorkflowDefinition,
  validateWorkflowSemantics,
  type CanonicalWorkflow,
  type FlowLensDiagnostic,
  type InputFormat,
  type WorkflowAnalysisResult,
} from '@flowlens/core';

export type ProcessingStage =
  'empty' | 'parse-error' | 'schema-error' | 'semantic-error' | 'ready' | 'internal-error';

export interface WorkflowProcessingResult {
  readonly stage: ProcessingStage;
  readonly diagnostics: readonly FlowLensDiagnostic[];
  readonly workflow?: CanonicalWorkflow;
  readonly diagramWorkflow?: CanonicalWorkflow;
  readonly analysis?: WorkflowAnalysisResult;
  readonly applicationError?: string;
}

const EMPTY_RESULT: WorkflowProcessingResult = Object.freeze({
  stage: 'empty',
  diagnostics: [],
});

export const processWorkflowText = (
  source: string,
  format: InputFormat,
): WorkflowProcessingResult => {
  if (source.trim().length === 0) {
    return EMPTY_RESULT;
  }

  try {
    const parsed = parseWorkflowText(source, format);
    if (!parsed.success) {
      const diagnostic: FlowLensDiagnostic = {
        code: parsed.code,
        severity: 'error',
        category: 'parse',
        message: parsed.message,
        ...(parsed.location === undefined ? {} : { location: parsed.location }),
      };
      return { stage: 'parse-error', diagnostics: [diagnostic] };
    }

    const structural = validateWorkflowDefinition(parsed.data);
    if (!structural.success) {
      return { stage: 'schema-error', diagnostics: structural.diagnostics };
    }

    const workflow = normalizeWorkflowDefinition(structural.definition);
    const semantic = validateWorkflowSemantics(workflow);
    const analysis = analyzeWorkflow(workflow);
    const diagnostics: readonly FlowLensDiagnostic[] = [
      ...structural.diagnostics,
      ...semantic.diagnostics,
    ];

    if (semantic.hasErrors) {
      return {
        stage: 'semantic-error',
        diagnostics,
        workflow,
        analysis,
      };
    }

    return {
      stage: 'ready',
      diagnostics,
      workflow,
      diagramWorkflow: workflow,
      analysis,
    };
  } catch {
    return {
      stage: 'internal-error',
      diagnostics: [],
      applicationError: 'FlowLens could not process this workflow safely.',
    };
  }
};
