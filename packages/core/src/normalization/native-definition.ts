import type { JsonObject } from '../metadata/json-value';
import type { CanonicalStepStatus, CanonicalStepType } from '../model/domain-values';
import type { FlowLensSchemaVersion, StepId, WorkflowId } from '../model/workflow';

/**
 * Narrow input contract for normalization after structural compatibility has
 * been established. P03 does not validate arbitrary parser output into this type.
 */
export interface NormalizationCompatibleWorkflowDefinition {
  readonly schemaVersion: FlowLensSchemaVersion;
  readonly id?: WorkflowId;
  readonly name: string;
  readonly description?: string;
  readonly steps: readonly NormalizationCompatibleStepDefinition[];
  readonly transitions: readonly NormalizationCompatibleTransitionDefinition[];
  readonly metadata?: JsonObject;
}

export interface NormalizationCompatibleStepDefinition {
  readonly id: StepId;
  readonly label: string;
  readonly type?: CanonicalStepType;
  readonly description?: string;
  readonly status?: CanonicalStepStatus;
  readonly metadata?: JsonObject;
}

export interface NormalizationCompatibleTransitionDefinition {
  readonly id?: string;
  readonly source: StepId;
  readonly target: StepId;
  readonly label?: string;
  /** Opaque descriptive data only; normalization never evaluates this string. */
  readonly condition?: string;
  readonly metadata?: JsonObject;
}
