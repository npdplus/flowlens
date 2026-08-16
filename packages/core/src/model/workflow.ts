import type { CanonicalMetadata } from '../metadata/json-value';
import type { CanonicalStepStatus, CanonicalStepType } from './domain-values';

export type FlowLensSchemaVersion = '0.1';
export type WorkflowId = string;
export type StepId = string;
export type TransitionInternalId = string;
export type SourceDefinedTransitionId = string;

export interface CanonicalWorkflow {
  readonly schemaVersion: FlowLensSchemaVersion;
  readonly id?: WorkflowId;
  readonly name: string;
  readonly description?: string;
  readonly steps: readonly CanonicalStep[];
  readonly transitions: readonly CanonicalTransition[];
  readonly metadata: CanonicalMetadata;
}

export interface CanonicalStep {
  readonly id: StepId;
  readonly label: string;
  readonly type: CanonicalStepType;
  readonly description?: string;
  readonly status?: CanonicalStepStatus;
  readonly metadata: CanonicalMetadata;
}

export interface CanonicalTransition {
  /** Stable processing identity. Generation of this value belongs to normalization in P03. */
  readonly internalId: TransitionInternalId;
  /** Optional identifier authored in the source workflow definition. */
  readonly sourceDefinedId?: SourceDefinedTransitionId;
  readonly sourceStepId: StepId;
  readonly targetStepId: StepId;
  readonly label?: string;
  /** Opaque descriptive text. Core never evaluates or executes this value. */
  readonly condition?: string;
  readonly metadata: CanonicalMetadata;
}
