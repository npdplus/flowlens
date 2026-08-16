import { JSON_SCHEMA, YAMLException, load } from 'js-yaml';

import type { ParseResult, ParseSourceLocation } from './parse-result';

const getYamlLocation = (error: YAMLException): ParseSourceLocation | undefined => {
  const { mark } = error;

  if (mark === undefined) {
    return undefined;
  }

  return {
    line: mark.line + 1,
    column: mark.column + 1,
  };
};

/**
 * Parse YAML using js-yaml's JSON-compatible schema. No executable/custom tag
 * constructors are enabled, and successful data remains untrusted `unknown`.
 */
export const parseYaml = (source: string): ParseResult => {
  try {
    const parsed: unknown = load(source, { schema: JSON_SCHEMA });

    return {
      success: true,
      format: 'yaml',
      // An empty YAML document has no constructed value; expose JSON-compatible null.
      data: parsed === undefined ? null : parsed,
    };
  } catch (error: unknown) {
    if (error instanceof YAMLException) {
      const location = getYamlLocation(error);
      const failure = {
        success: false as const,
        format: 'yaml' as const,
        code: 'FL1002' as const,
        message: error.reason || 'Invalid YAML syntax.',
      };

      return location === undefined ? failure : { ...failure, location };
    }

    return {
      success: false,
      format: 'yaml',
      code: 'FL1002',
      message: error instanceof Error ? error.message : 'Invalid YAML syntax.',
    };
  }
};
