# FlowLens Workflow Definition V0.1

FlowLens V0.1 accepts a small, versioned workflow definition in JSON or YAML. JSON and YAML are serialization formats for the same logical contract.

The application release version (`v0.1.0`) and workflow schema version (`0.1`) are separate.

## Minimal workflow

```yaml
schemaVersion: '0.1'
name: Single Step
steps:
  - id: only-step
    label: Only Step
transitions: []
```

## Top-level fields

| Field | Required | Meaning |
| --- | --- | --- |
| `schemaVersion` | Yes | Must be the string `"0.1"` for this schema line. |
| `id` | No | Stable workflow identifier. |
| `name` | Yes | Non-empty human-readable workflow name. |
| `description` | No | Plain-text workflow description. |
| `steps` | Yes | Array containing at least one step. |
| `transitions` | Yes | Array of explicit transitions. |
| `metadata` | No | JSON-compatible extension data. |

## Steps

Each step requires:

- `id`: a non-empty, case-sensitive identifier unique within the workflow;
- `label`: a non-empty human-readable label.

Optional step fields:

- `type`: `start`, `action`, `decision`, or `end`; omitted `type` normalizes to `action`;
- `description`: plain text;
- `status`: `pending`, `active`, `success`, `warning`, `failed`, or `skipped`;
- `metadata`: JSON-compatible extension data.

Step IDs are machine-facing references. Labels may change without changing topology.

## Transitions

Every transition requires:

- `source`: the ID of an existing source step;
- `target`: the ID of an existing target step.

Optional transition fields:

- `id`: a stable transition identifier;
- `label`: plain-text branch/transition label;
- `condition`: opaque descriptive text;
- `metadata`: JSON-compatible extension data.

Topology is defined only by explicit transitions. The order of the `steps` array does not create implicit edges.

## Conditions are data, not code

FlowLens displays and preserves transition conditions, but does not execute them. A condition is never treated as JavaScript, HTML, a template expression, or a request to an external service.

For example:

```yaml
condition: approved == true
```

is descriptive text only.

## Metadata

Workflow, step, and transition metadata may contain JSON-compatible values:

- string;
- number;
- boolean;
- null;
- arrays of JSON-compatible values;
- objects containing JSON-compatible values.

Metadata is extension data. Unknown domain-specific fields should be placed under `metadata` instead of being treated as new workflow semantics.

## Graph semantics

FlowLens V0.1 supports:

- multiple entry candidates;
- multiple terminal candidates;
- decisions with two or more outgoing branches;
- cycles and retry/review loops;
- self-loops;
- disconnected content that semantic validation can report.

A cycle is not automatically invalid. A self-loop is not rejected solely because it is a self-loop.

Declared `start` and `end` types express intent. Semantic validation can report contradictions between those declarations and actual graph topology.

## Validation and analysis

The production processing path is:

```text
Parse
  ↓
Structural Validation
  ↓
Normalization
  ↓
Canonical Workflow Model
  ↓
Semantic Validation
  ↓
Workflow Analysis
```

Structural validation checks the supported document shape and field values. Semantic validation checks graph identity, references, reachability, entry/terminal behavior, cycles, and related topology rules.

Diagnostics use stable `FL####` identifiers. Workflow analysis is separate from validity: a workflow can be valid while still having noteworthy structural characteristics.

## Example

```yaml
schemaVersion: '0.1'
id: purchase-approval
name: Purchase Approval

description: Example approval workflow

steps:
  - id: request
    label: Submit Request
    type: start

  - id: manager
    label: Manager Approval
    type: decision
    status: active

  - id: completed
    label: Completed
    type: end
    status: success

  - id: rejected
    label: Rejected
    type: end
    status: failed

transitions:
  - source: request
    target: manager

  - source: manager
    target: completed
    label: Approved
    condition: approved == true

  - source: manager
    target: rejected
    label: Rejected
    condition: approved == false
```

## Compatibility

Within the `0.1` schema line, existing field meanings should remain stable. Breaking schema changes require a new schema version. Future FlowLens application releases may support multiple schema versions without coupling schema version numbers to application version numbers.

## Security boundary

Workflow input is untrusted data. FlowLens V0.1 does not define executable JavaScript, inline scripts, executable templates, custom code callbacks, dynamic modules, or condition evaluation as workflow semantics.

See `SECURITY.md` for the product security model and vulnerability reporting guidance.
