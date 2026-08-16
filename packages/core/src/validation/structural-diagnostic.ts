import type { FlowLensDiagnostic } from '../diagnostics/diagnostic';

export const STRUCTURAL_DIAGNOSTIC_CODES = [
  'FL1101',
  'FL1102',
  'FL1103',
  'FL1104',
  'FL1105',
  'FL1106',
  'FL1107',
] as const;

export type StructuralDiagnosticCode = (typeof STRUCTURAL_DIAGNOSTIC_CODES)[number];
export type StructuralDiagnosticSeverity = 'error' | 'warning';

export interface StructuralDiagnostic extends Omit<
  FlowLensDiagnostic,
  'code' | 'severity' | 'category'
> {
  readonly code: StructuralDiagnosticCode;
  readonly severity: StructuralDiagnosticSeverity;
  readonly category: 'schema';
}
