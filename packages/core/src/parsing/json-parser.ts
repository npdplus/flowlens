import type { ParseResult } from './parse-result';

const messageFromUnknownError = (error: unknown): string =>
  error instanceof Error ? error.message : 'Invalid JSON syntax.';

/** Parse standard JSON syntax without asserting any workflow structure or semantics. */
export const parseJson = (source: string): ParseResult => {
  try {
    const data: unknown = JSON.parse(source);

    return {
      success: true,
      format: 'json',
      data,
    };
  } catch (error: unknown) {
    return {
      success: false,
      format: 'json',
      code: 'FL1001',
      message: messageFromUnknownError(error),
    };
  }
};
