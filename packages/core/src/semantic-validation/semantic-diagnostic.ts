import type { FlowLensDiagnostic } from '../diagnostics/diagnostic';

export const SEMANTIC_DIAGNOSTIC_CODES = [
  'FL2001',
  'FL2002',
  'FL2003',
  'FL2004',
  'FL2101',
  'FL2102',
  'FL2103',
  'FL2104',
  'FL2105',
  'FL2106',
  'FL2107',
  'FL2108',
  'FL2109',
] as const;

export type SemanticDiagnosticCode = (typeof SEMANTIC_DIAGNOSTIC_CODES)[number];

export const P05_ANALYSIS_DIAGNOSTIC_CODES = ['FL3001', 'FL3002'] as const;
export type P05AnalysisDiagnosticCode = (typeof P05_ANALYSIS_DIAGNOSTIC_CODES)[number];

export interface SemanticDiagnostic extends FlowLensDiagnostic {
  readonly code: SemanticDiagnosticCode;
  readonly category: 'semantic';
}

export interface P05AnalysisDiagnostic extends FlowLensDiagnostic {
  readonly code: P05AnalysisDiagnosticCode;
  readonly severity: 'info';
  readonly category: 'analysis';
}

export type SemanticValidationDiagnostic = SemanticDiagnostic | P05AnalysisDiagnostic;
