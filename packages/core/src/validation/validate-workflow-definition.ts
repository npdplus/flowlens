import type { DiagnosticEntity } from '../diagnostics/diagnostic';
import type {
  NormalizationCompatibleStepDefinition,
  NormalizationCompatibleTransitionDefinition,
  NormalizationCompatibleWorkflowDefinition,
} from '../normalization/native-definition';
import { validateMetadataObject, type ValidationPathSegment } from './metadata-validation';
import type { StructuralDiagnostic, StructuralDiagnosticCode } from './structural-diagnostic';
import { workflowDefinitionSchema, type WorkflowDefinitionSchemaOutput } from './workflow-schema';

export type ValidatedNativeWorkflowDefinition = NormalizationCompatibleWorkflowDefinition;

export interface StructuralValidationSuccess {
  readonly success: true;
  readonly definition: ValidatedNativeWorkflowDefinition;
  readonly diagnostics: readonly StructuralDiagnostic[];
}

export interface StructuralValidationFailure {
  readonly success: false;
  readonly diagnostics: readonly StructuralDiagnostic[];
}

export type StructuralValidationResult = StructuralValidationSuccess | StructuralValidationFailure;

interface DiagnosticCandidate {
  readonly diagnostic: StructuralDiagnostic;
  readonly pathSegments: readonly ValidationPathSegment[];
  readonly sequence: number;
}

interface SchemaIssueLike {
  readonly code: string;
  readonly path: readonly PropertyKey[];
}

const WORKFLOW_FIELDS = new Set([
  'schemaVersion',
  'id',
  'name',
  'description',
  'steps',
  'transitions',
  'metadata',
]);
const STEP_FIELDS = new Set(['id', 'label', 'type', 'description', 'status', 'metadata']);
const TRANSITION_FIELDS = new Set(['id', 'source', 'target', 'label', 'condition', 'metadata']);
const SIMPLE_PATH_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;

const isInspectableObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null;

const issuePath = (path: readonly PropertyKey[]): readonly ValidationPathSegment[] =>
  path.map((segment) => (typeof segment === 'number' ? segment : String(segment)));

const formatPath = (segments: readonly ValidationPathSegment[]): string | undefined => {
  if (segments.length === 0) {
    return undefined;
  }

  let result = '';
  for (const segment of segments) {
    if (typeof segment === 'number') {
      result += `[${segment}]`;
      continue;
    }

    if (SIMPLE_PATH_KEY.test(segment)) {
      result += result.length === 0 ? segment : `.${segment}`;
      continue;
    }

    result += `[${JSON.stringify(segment)}]`;
  }
  return result;
};

const compareStrings = (left: string, right: string): number => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const comparePathSegments = (
  left: readonly ValidationPathSegment[],
  right: readonly ValidationPathSegment[],
): number => {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftSegment = left[index];
    const rightSegment = right[index];
    if (leftSegment === rightSegment) {
      continue;
    }
    if (typeof leftSegment === 'number' && typeof rightSegment === 'number') {
      return leftSegment - rightSegment;
    }
    if (typeof leftSegment === 'string' && typeof rightSegment === 'string') {
      return compareStrings(leftSegment, rightSegment);
    }
    return typeof leftSegment === 'string' ? -1 : 1;
  }
  return left.length - right.length;
};

const sortDiagnostics = (
  candidates: readonly DiagnosticCandidate[],
): readonly StructuralDiagnostic[] =>
  [...candidates]
    .sort((left, right) => {
      const pathComparison = comparePathSegments(left.pathSegments, right.pathSegments);
      if (pathComparison !== 0) {
        return pathComparison;
      }
      const codeComparison = compareStrings(left.diagnostic.code, right.diagnostic.code);
      return codeComparison !== 0 ? codeComparison : left.sequence - right.sequence;
    })
    .map(({ diagnostic }) => diagnostic);

const createDiagnostic = (
  code: StructuralDiagnosticCode,
  severity: 'error' | 'warning',
  message: string,
  pathSegments: readonly ValidationPathSegment[],
  entity?: DiagnosticEntity,
): StructuralDiagnostic => {
  const path = formatPath(pathSegments);
  return {
    code,
    severity,
    category: 'schema',
    message,
    ...(path === undefined ? {} : { path }),
    ...(entity === undefined ? {} : { entity }),
  };
};

const hasOwnPath = (root: unknown, path: readonly ValidationPathSegment[]): boolean => {
  if (path.length === 0) {
    return true;
  }

  let current: unknown = root;
  for (const segment of path) {
    if (!isInspectableObject(current)) {
      return false;
    }

    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(current, String(segment));
    } catch {
      return false;
    }
    if (descriptor === undefined) {
      return false;
    }
    if ('get' in descriptor || 'set' in descriptor) {
      return true;
    }
    current = descriptor.value;
  }
  return true;
};

const schemaIssueToDiagnostic = (issue: SchemaIssueLike, input: unknown): StructuralDiagnostic => {
  const pathSegments = issuePath(issue.path);
  const path = formatPath(pathSegments) ?? '<root>';

  if (!hasOwnPath(input, pathSegments)) {
    return createDiagnostic(
      'FL1102',
      'error',
      `Missing required field at "${path}".`,
      pathSegments,
    );
  }

  if (issue.code === 'invalid_type') {
    return createDiagnostic(
      'FL1103',
      'error',
      `Field "${path}" has an invalid type.`,
      pathSegments,
    );
  }

  if (pathSegments.length === 1 && pathSegments[0] === 'schemaVersion') {
    return createDiagnostic(
      'FL1101',
      'error',
      'Unsupported schema version. FlowLens V0.1 supports schemaVersion "0.1".',
      pathSegments,
    );
  }

  if (issue.code === 'too_small' && pathSegments.length === 1 && pathSegments[0] === 'steps') {
    return createDiagnostic(
      'FL1105',
      'error',
      'Workflow must contain at least one step.',
      pathSegments,
    );
  }

  return createDiagnostic('FL1104', 'error', `Field "${path}" has an invalid value.`, pathSegments);
};

const getOwnDataProperty = (
  value: unknown,
  key: string,
):
  | { readonly exists: false }
  | { readonly exists: true; readonly safe: false }
  | {
      readonly exists: true;
      readonly safe: true;
      readonly value: unknown;
    } => {
  if (!isInspectableObject(value)) {
    return { exists: false };
  }

  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) {
      return { exists: false };
    }
    if ('get' in descriptor || 'set' in descriptor) {
      return { exists: true, safe: false };
    }
    return { exists: true, safe: true, value: descriptor.value };
  } catch {
    return { exists: true, safe: false };
  }
};

const collectMetadataDiagnostic = (
  candidates: DiagnosticCandidate[],
  container: unknown,
  basePath: readonly ValidationPathSegment[],
  entity: DiagnosticEntity | undefined,
  nextSequence: () => number,
): void => {
  const property = getOwnDataProperty(container, 'metadata');
  if (!property.exists) {
    return;
  }

  const metadataPath = [...basePath, 'metadata'];
  if (!property.safe) {
    candidates.push({
      diagnostic: createDiagnostic(
        'FL1106',
        'error',
        `Metadata at "${formatPath(metadataPath)}" must be JSON-compatible data.`,
        metadataPath,
        entity,
      ),
      pathSegments: metadataPath,
      sequence: nextSequence(),
    });
    return;
  }

  const validation = validateMetadataObject(property.value);
  if (validation.valid) {
    return;
  }

  const invalidPath = [...metadataPath, ...validation.path];
  candidates.push({
    diagnostic: createDiagnostic(
      'FL1106',
      'error',
      `Metadata at "${formatPath(invalidPath)}" must contain JSON-compatible, non-executable data.`,
      invalidPath,
      entity,
    ),
    pathSegments: invalidPath,
    sequence: nextSequence(),
  });
};

const collectMetadataDiagnostics = (
  input: unknown,
  candidates: DiagnosticCandidate[],
  nextSequence: () => number,
): void => {
  collectMetadataDiagnostic(candidates, input, [], undefined, nextSequence);

  const stepsProperty = getOwnDataProperty(input, 'steps');
  if (stepsProperty.exists && stepsProperty.safe && Array.isArray(stepsProperty.value)) {
    stepsProperty.value.forEach((step, index) => {
      collectMetadataDiagnostic(
        candidates,
        step,
        ['steps', index],
        { kind: 'step', index },
        nextSequence,
      );
    });
  }

  const transitionsProperty = getOwnDataProperty(input, 'transitions');
  if (
    transitionsProperty.exists &&
    transitionsProperty.safe &&
    Array.isArray(transitionsProperty.value)
  ) {
    transitionsProperty.value.forEach((transition, index) => {
      collectMetadataDiagnostic(
        candidates,
        transition,
        ['transitions', index],
        { kind: 'transition', index },
        nextSequence,
      );
    });
  }
};

const collectUnknownFieldsAt = (
  candidates: DiagnosticCandidate[],
  value: unknown,
  knownFields: ReadonlySet<string>,
  basePath: readonly ValidationPathSegment[],
  entity: DiagnosticEntity | undefined,
  nextSequence: () => number,
): void => {
  if (!isInspectableObject(value) || Array.isArray(value)) {
    return;
  }

  let keys: string[];
  try {
    keys = Object.keys(value);
  } catch {
    return;
  }

  for (const key of keys) {
    if (knownFields.has(key)) {
      continue;
    }
    const pathSegments = [...basePath, key];
    const path = formatPath(pathSegments) ?? key;
    candidates.push({
      diagnostic: createDiagnostic(
        'FL1107',
        'warning',
        `Unknown definition field "${path}" is ignored; use metadata for extensions.`,
        pathSegments,
        entity,
      ),
      pathSegments,
      sequence: nextSequence(),
    });
  }
};

const collectUnknownFieldDiagnostics = (
  input: unknown,
  candidates: DiagnosticCandidate[],
  nextSequence: () => number,
): void => {
  collectUnknownFieldsAt(candidates, input, WORKFLOW_FIELDS, [], undefined, nextSequence);

  const stepsProperty = getOwnDataProperty(input, 'steps');
  if (stepsProperty.exists && stepsProperty.safe && Array.isArray(stepsProperty.value)) {
    stepsProperty.value.forEach((step, index) => {
      collectUnknownFieldsAt(
        candidates,
        step,
        STEP_FIELDS,
        ['steps', index],
        { kind: 'step', index },
        nextSequence,
      );
    });
  }

  const transitionsProperty = getOwnDataProperty(input, 'transitions');
  if (
    transitionsProperty.exists &&
    transitionsProperty.safe &&
    Array.isArray(transitionsProperty.value)
  ) {
    transitionsProperty.value.forEach((transition, index) => {
      collectUnknownFieldsAt(
        candidates,
        transition,
        TRANSITION_FIELDS,
        ['transitions', index],
        { kind: 'transition', index },
        nextSequence,
      );
    });
  }
};

const toStepDefinition = (
  step: WorkflowDefinitionSchemaOutput['steps'][number],
): NormalizationCompatibleStepDefinition => ({
  id: step.id,
  label: step.label,
  ...(step.type === undefined ? {} : { type: step.type }),
  ...(step.description === undefined ? {} : { description: step.description }),
  ...(step.status === undefined ? {} : { status: step.status }),
  ...(step.metadata === undefined ? {} : { metadata: step.metadata }),
});

const toTransitionDefinition = (
  transition: WorkflowDefinitionSchemaOutput['transitions'][number],
): NormalizationCompatibleTransitionDefinition => ({
  ...(transition.id === undefined ? {} : { id: transition.id }),
  source: transition.source,
  target: transition.target,
  ...(transition.label === undefined ? {} : { label: transition.label }),
  ...(transition.condition === undefined ? {} : { condition: transition.condition }),
  ...(transition.metadata === undefined ? {} : { metadata: transition.metadata }),
});

const toValidatedDefinition = (
  definition: WorkflowDefinitionSchemaOutput,
): ValidatedNativeWorkflowDefinition => ({
  schemaVersion: definition.schemaVersion,
  ...(definition.id === undefined ? {} : { id: definition.id }),
  name: definition.name,
  ...(definition.description === undefined ? {} : { description: definition.description }),
  steps: definition.steps.map(toStepDefinition),
  transitions: definition.transitions.map(toTransitionDefinition),
  ...(definition.metadata === undefined ? {} : { metadata: definition.metadata }),
});

/**
 * Validate untrusted parsed data against the FlowLens Workflow Definition V0.1
 * structural contract. Only a successful result exposes normalization-compatible data.
 */
export const validateWorkflowDefinition = (input: unknown): StructuralValidationResult => {
  let parsed: ReturnType<typeof workflowDefinitionSchema.safeParse>;
  try {
    parsed = workflowDefinitionSchema.safeParse(input);
  } catch {
    return {
      success: false,
      diagnostics: [
        createDiagnostic(
          'FL1103',
          'error',
          'Workflow definition could not be inspected safely as a V0.1 workflow object.',
          [],
        ),
      ],
    };
  }

  const candidates: DiagnosticCandidate[] = [];
  let sequence = 0;
  const nextSequence = (): number => {
    const current = sequence;
    sequence += 1;
    return current;
  };

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const pathSegments = issuePath(issue.path);
      if (issue.code === 'custom' && pathSegments.at(-1) === 'metadata') {
        continue;
      }
      candidates.push({
        diagnostic: schemaIssueToDiagnostic(issue, input),
        pathSegments,
        sequence: nextSequence(),
      });
    }
  }

  collectMetadataDiagnostics(input, candidates, nextSequence);
  collectUnknownFieldDiagnostics(input, candidates, nextSequence);

  let diagnostics = sortDiagnostics(candidates);
  if (!parsed.success && !diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    const fallback = createDiagnostic(
      'FL1104',
      'error',
      'Workflow definition does not satisfy the FlowLens V0.1 structural contract.',
      [],
    );
    diagnostics = [fallback, ...diagnostics];
  }

  if (!parsed.success || diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    return { success: false, diagnostics };
  }

  return {
    success: true,
    definition: toValidatedDefinition(parsed.data),
    diagnostics,
  };
};
