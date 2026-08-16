import type { InputFormat } from './input-format';
import { parseJson } from './json-parser';
import type { ParseResult } from './parse-result';
import { parseYaml } from './yaml-parser';

/** Parse raw text using an explicitly selected supported input format. */
export const parseWorkflowText = (source: string, format: InputFormat): ParseResult => {
  switch (format) {
    case 'json':
      return parseJson(source);
    case 'yaml':
      return parseYaml(source);
  }
};
