export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/** Canonical metadata is normalized JSON-compatible object data only. */
export type CanonicalMetadata = JsonObject;
