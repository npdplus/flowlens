import type { JsonObject } from '../metadata/json-value';

export const DIAGNOSTIC_SEVERITIES = ['error', 'warning', 'info'] as const;
export type DiagnosticSeverity = (typeof DIAGNOSTIC_SEVERITIES)[number];

export const DIAGNOSTIC_CATEGORIES = [
  'parse',
  'schema',
  'semantic',
  'analysis',
  'internal',
] as const;
export type DiagnosticCategory = (typeof DIAGNOSTIC_CATEGORIES)[number];

export interface DiagnosticSourceLocation {
  /** 1-based line number for display. */
  readonly line: number;
  /** 1-based column number for display. */
  readonly column: number;
}

export type DiagnosticEntityKind = 'workflow' | 'step' | 'transition';

export interface DiagnosticEntity {
  readonly kind: DiagnosticEntityKind;
  readonly id?: string;
  readonly index?: number;
}

/** Shared, renderer-independent FlowLens diagnostic contract. */
export interface FlowLensDiagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly category: DiagnosticCategory;
  readonly message: string;
  readonly path?: string;
  readonly entity?: DiagnosticEntity;
  readonly location?: DiagnosticSourceLocation;
  readonly details?: JsonObject;
}
