import { z } from 'zod';

import type { JsonObject } from '../metadata/json-value';
import { CANONICAL_STEP_STATUSES, CANONICAL_STEP_TYPES } from '../model/domain-values';
import { validateMetadataObject } from './metadata-validation';

const nonEmptyStringSchema = z.string().min(1);
const metadataSchema = z.custom<JsonObject>((value) => validateMetadataObject(value).valid);

const stepSchema = z.object({
  id: nonEmptyStringSchema,
  label: nonEmptyStringSchema,
  type: z.enum(CANONICAL_STEP_TYPES).optional(),
  description: z.string().optional(),
  status: z.enum(CANONICAL_STEP_STATUSES).optional(),
  metadata: metadataSchema.optional(),
});

const transitionSchema = z.object({
  id: nonEmptyStringSchema.optional(),
  source: nonEmptyStringSchema,
  target: nonEmptyStringSchema,
  label: z.string().optional(),
  condition: z.string().optional(),
  metadata: metadataSchema.optional(),
});

export const workflowDefinitionSchema = z.object({
  schemaVersion: z.string().pipe(z.literal('0.1')),
  id: nonEmptyStringSchema.optional(),
  name: nonEmptyStringSchema,
  description: z.string().optional(),
  steps: z.array(stepSchema).min(1),
  transitions: z.array(transitionSchema),
  metadata: metadataSchema.optional(),
});

export type WorkflowDefinitionSchemaOutput = z.output<typeof workflowDefinitionSchema>;
