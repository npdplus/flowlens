import type { JsonObject } from '../metadata/json-value';

export type ValidationPathSegment = string | number;

type MetadataFailureReason =
  | 'accessor'
  | 'cycle'
  | 'non-finite-number'
  | 'non-json-value'
  | 'non-plain-object'
  | 'sparse-array'
  | 'symbol-key'
  | 'unexpected-property';

export type MetadataValidationResult =
  | { readonly valid: true; readonly value: JsonObject }
  | {
      readonly valid: false;
      readonly path: readonly ValidationPathSegment[];
      readonly reason: MetadataFailureReason;
    };

type TraverseFrame =
  | {
      readonly kind: 'visit';
      readonly value: unknown;
      readonly path: readonly ValidationPathSegment[];
    }
  | { readonly kind: 'exit'; readonly value: object };

const failure = (
  path: readonly ValidationPathSegment[],
  reason: MetadataFailureReason,
): MetadataValidationResult => ({ valid: false, path, reason });

const isPlainObject = (value: object): boolean => {
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
};

const validateJsonCompatibleGraph = (root: object): MetadataValidationResult => {
  const activeAncestors = new WeakSet<object>();
  const stack: TraverseFrame[] = [{ kind: 'visit', value: root, path: [] }];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) {
      break;
    }

    if (frame.kind === 'exit') {
      activeAncestors.delete(frame.value);
      continue;
    }

    const { value, path } = frame;

    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
      continue;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return failure(path, 'non-finite-number');
      }
      continue;
    }

    if (typeof value !== 'object') {
      return failure(path, 'non-json-value');
    }

    if (activeAncestors.has(value)) {
      return failure(path, 'cycle');
    }

    activeAncestors.add(value);
    stack.push({ kind: 'exit', value });

    let descriptors: PropertyDescriptorMap;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch {
      return failure(path, 'non-json-value');
    }

    const ownKeys = Reflect.ownKeys(descriptors);
    const symbolKey = ownKeys.find((key) => typeof key === 'symbol');
    if (symbolKey !== undefined) {
      return failure(path, 'symbol-key');
    }

    if (Array.isArray(value)) {
      const length = value.length;
      for (const key of ownKeys) {
        if (key === 'length') {
          continue;
        }
        const numericIndex = Number(key);
        if (
          !Number.isInteger(numericIndex) ||
          numericIndex < 0 ||
          numericIndex >= length ||
          String(numericIndex) !== key
        ) {
          return failure(path, 'unexpected-property');
        }
      }

      for (let index = length - 1; index >= 0; index -= 1) {
        const descriptor = descriptors[String(index)];
        if (descriptor === undefined) {
          return failure([...path, index], 'sparse-array');
        }
        if ('get' in descriptor || 'set' in descriptor) {
          return failure([...path, index], 'accessor');
        }
        stack.push({ kind: 'visit', value: descriptor.value, path: [...path, index] });
      }
      continue;
    }

    if (!isPlainObject(value)) {
      return failure(path, 'non-plain-object');
    }

    const keys = Object.keys(descriptors);
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      if (key === undefined) {
        continue;
      }
      const descriptor = descriptors[key];
      if (descriptor === undefined) {
        continue;
      }
      if (!descriptor.enumerable) {
        return failure([...path, key], 'unexpected-property');
      }
      if ('get' in descriptor || 'set' in descriptor) {
        return failure([...path, key], 'accessor');
      }
      stack.push({ kind: 'visit', value: descriptor.value, path: [...path, key] });
    }
  }

  return { valid: true, value: root as JsonObject };
};

/**
 * Validate a metadata field without recursion or executing getters/callbacks.
 * Metadata fields are object maps whose nested values follow JSON data rules.
 */
export const validateMetadataObject = (value: unknown): MetadataValidationResult => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return failure([], 'non-plain-object');
  }
  if (!isPlainObject(value)) {
    return failure([], 'non-plain-object');
  }
  return validateJsonCompatibleGraph(value);
};
