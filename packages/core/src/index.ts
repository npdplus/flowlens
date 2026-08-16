export const FLOWLENS_CORE_FOUNDATION = Object.freeze({
  packageName: '@flowlens/core',
  phase: 'P01',
  purpose: 'repository-foundation',
} as const);

export {
  analyzeWorkflow,
  type WorkflowAnalysisResult,
  type WorkflowBranchingAnalysis,
  type WorkflowComponentAnalysis,
  type WorkflowCycleAnalysis,
  type WorkflowCycleGroup,
  type WorkflowEntryAnalysis,
  type WorkflowSelfLoopAnalysis,
  type WorkflowTerminalAnalysis,
} from './analysis/workflow-analysis';
export type {
  DiagnosticCategory,
  DiagnosticEntity,
  DiagnosticEntityKind,
  DiagnosticSeverity,
  DiagnosticSourceLocation,
  FlowLensDiagnostic,
} from './diagnostics/diagnostic';
export { DIAGNOSTIC_CATEGORIES, DIAGNOSTIC_SEVERITIES } from './diagnostics/diagnostic';
export {
  buildWorkflowGraphIndex,
  type IndexedCanonicalStep,
  type IndexedCanonicalTransition,
  type WorkflowGraphIndex,
} from './graph/workflow-graph-index';
export type {
  CanonicalMetadata,
  JsonObject,
  JsonPrimitive,
  JsonValue,
} from './metadata/json-value';
export {
  CANONICAL_STEP_STATUSES,
  CANONICAL_STEP_TYPES,
  type CanonicalStepStatus,
  type CanonicalStepType,
} from './model/domain-values';
export type {
  CanonicalStep,
  CanonicalTransition,
  CanonicalWorkflow,
  FlowLensSchemaVersion,
  SourceDefinedTransitionId,
  StepId,
  TransitionInternalId,
  WorkflowId,
} from './model/workflow';
export type {
  NormalizationCompatibleStepDefinition,
  NormalizationCompatibleTransitionDefinition,
  NormalizationCompatibleWorkflowDefinition,
} from './normalization/native-definition';
export { normalizeWorkflowDefinition } from './normalization/normalize-workflow';
export { createTransitionInternalId } from './normalization/transition-identity';
export { INPUT_FORMATS, type InputFormat } from './parsing/input-format';
export { parseJson } from './parsing/json-parser';
export type {
  ParseFailure,
  ParseFailureCode,
  ParseResult,
  ParseSourceLocation,
  ParseSuccess,
} from './parsing/parse-result';
export { parseWorkflowText } from './parsing/parse-workflow-text';
export { parseYaml } from './parsing/yaml-parser';
export {
  P05_ANALYSIS_DIAGNOSTIC_CODES,
  SEMANTIC_DIAGNOSTIC_CODES,
  type P05AnalysisDiagnostic,
  type P05AnalysisDiagnosticCode,
  type SemanticDiagnostic,
  type SemanticDiagnosticCode,
  type SemanticValidationDiagnostic,
} from './semantic-validation/semantic-diagnostic';
export {
  validateWorkflowSemantics,
  type SemanticValidationResult,
} from './semantic-validation/validate-workflow-semantics';
export {
  STRUCTURAL_DIAGNOSTIC_CODES,
  type StructuralDiagnostic,
  type StructuralDiagnosticCode,
  type StructuralDiagnosticSeverity,
} from './validation/structural-diagnostic';
export {
  validateWorkflowDefinition,
  type StructuralValidationFailure,
  type StructuralValidationResult,
  type StructuralValidationSuccess,
  type ValidatedNativeWorkflowDefinition,
} from './validation/validate-workflow-definition';
