import type { InputFormat } from './input-format';

export type ParseFailureCode = 'FL1001' | 'FL1002';

export interface ParseSourceLocation {
  /** 1-based line number for display. */
  readonly line: number;
  /** 1-based column number for display. */
  readonly column: number;
}

export interface ParseSuccess {
  readonly success: true;
  readonly format: InputFormat;
  /** Syntax-valid external data remains untrusted until P04 structural validation. */
  readonly data: unknown;
}

export interface ParseFailure {
  readonly success: false;
  readonly format: InputFormat;
  readonly code: ParseFailureCode;
  readonly message: string;
  readonly location?: ParseSourceLocation;
}

export type ParseResult = ParseSuccess | ParseFailure;
