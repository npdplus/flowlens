# FlowLens

> **Understand. Validate. Visualize.**

FlowLens is a local-first browser application that turns JSON or YAML workflow definitions into validated, analyzed, interactive workflow diagrams.

FlowLens is an **NPD PLUS Labs / Experimental Open-source** project. The `v0.1.0` release focuses on understanding workflows rather than executing or visually authoring them.

## What FlowLens does

FlowLens uses one production processing path:

```text
JSON / YAML
    ↓
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
    ↓
Automatic Layout
    ↓
Interactive Diagram
    ↓
Local SVG / PNG Export
```

The workflow definition remains the source of truth. FlowLens does not infer topology from step-array order and does not execute conditions.

### V0.1 capabilities

- JSON and YAML workflow definitions.
- Local `.json`, `.yaml`, and `.yml` file opening.
- CodeMirror 6 editing with line numbers and syntax highlighting.
- Structural and semantic validation.
- Stable `FL####` diagnostics with source navigation where available.
- Workflow analysis kept separate from validity.
- Automatic ELK layout.
- Read-only React Flow diagram.
- Pan, zoom, fit view, and semantic selection.
- Keyboard-focusable diagram entities.
- Step and transition Inspector.
- Light and dark themes.
- Local SVG and PNG export.
- Five synthetic built-in examples.
- No login, backend, database, or cloud workflow-storage requirement for core V0.1 behavior.

## Official examples

The repository contains five public-safe YAML examples:

1. Simple Sequential Workflow
2. Purchase Approval
3. CI/CD Deployment
4. AI Agent Workflow
5. Incident Response

Examples are loaded as source text and use the same parser, validation, analysis, layout, rendering, and export path as user-authored workflows.

## Quick start

Prerequisites:

- Node.js `24.18.0`
- pnpm `11.4.0`

Install from the committed lockfile:

```bash
corepack enable
corepack prepare pnpm@11.4.0 --activate
pnpm install --frozen-lockfile
```

Start the development server:

```bash
pnpm dev
```

Create a production build:

```bash
pnpm build
```

## Verification

Run the normal repository gates:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

Install Playwright Chromium and run the standard browser journeys:

```bash
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

Or, after Chromium is installed:

```bash
pnpm verify
```

The release suite adds an extended desktop-browser matrix, baseline keyboard/accessibility journeys, supply-chain/security checks, and representative performance workloads. Verified observations and limitations are recorded in `docs/release/V0.1_RELEASE_NOTES.md` rather than presented as universal guarantees.

## Workflow definition

FlowLens V0.1 uses **FlowLens Workflow Definition V0.1** with schema version `0.1`.

```yaml
schemaVersion: '0.1'
id: purchase-approval
name: Purchase Approval

steps:
  - id: request
    label: Submit Request
    type: start

  - id: manager
    label: Manager Approval
    type: decision

  - id: completed
    label: Completed
    type: end
    status: success

transitions:
  - source: request
    target: manager

  - source: manager
    target: completed
    label: Approved
    condition: approved == true
```

Important rules:

- `schemaVersion` is `"0.1"`.
- Topology is defined only by explicit transitions.
- Missing step `type` normalizes to `action`.
- Conditions are opaque descriptive strings and are never executed.
- Cycles and self-loops are representable.
- Validation findings and workflow-analysis findings are separate concepts.

See `docs/WORKFLOW_DEFINITION.md` for the public schema reference.

## Architecture

FlowLens keeps workflow semantics independent from UI and export concerns:

```text
packages/core
      ↑
packages/react
      ↑
apps/web
```

Direct `apps/web → packages/core` consumption is also allowed.

### `packages/core`

Framework-independent TypeScript for canonical workflow types, JSON/YAML parsing orchestration, structural validation, normalization, semantic validation, workflow analysis, diagnostics, and pure utilities.

Core has no React, React Flow, DOM, layout, export, or product-specific UI dependency.

### `packages/react`

Rendering integration for canonical-to-renderer mapping, ELK layout, React Flow nodes/transitions, semantic selection, and safe local diagram export.

### `apps/web`

Browser application composition for the editor, local file opening, diagnostics and analysis UI, diagram/Inspector, theme preference, examples, and export controls.

## Local-first privacy and security

Workflow content is untrusted data.

Core V0.1 behavior is designed to work without uploading workflow definitions. It does not require workflow-content telemetry, AI services, a remote export renderer, runtime credentials, a backend, or an account.

Security properties include:

- no `eval` or Function-constructor execution of workflow content;
- conditions and metadata are data rather than executable logic;
- no raw untrusted HTML rendering;
- script/HTML/URL-looking workflow strings remain inert text;
- export removes unsafe embedded element/attribute classes and rejects non-fragment external CSS resources;
- exported diagrams do not intentionally embed the complete canonical workflow object or hidden arbitrary metadata;
- local workflow files are processed in the browser;
- V0.1 persists theme preference only, not workflow definition content.

See `SECURITY.md` for vulnerability reporting and security expectations.

## Performance and practical limits

V0.1 does not publish a fixed maximum supported workflow size. Release verification measures representative **100-step**, **500-step**, and **1,000-step** synthetic workflows to observe processing, layout, browser rendering, interaction, and degradation behavior.

These are verification workloads, not contractual limits. Graph shape, labels, branching, browser/device resources, and export dimensions can materially change performance.

PNG export scales output so neither raster dimension exceeds `8192px`; very large diagrams can therefore trade raster resolution for bounded output size. SVG remains vector output but may itself become large for large rendered diagrams.

See `docs/release/V0.1_RELEASE_NOTES.md` for measured observations from the release-verification environment.

## V0.1 non-goals

V0.1 does not include:

- workflow execution;
- drag-and-drop workflow authoring;
- authentication or user accounts;
- cloud workflow storage or database persistence;
- collaboration or runtime monitoring;
- AI workflow generation/explanation;
- external workflow adapters;
- CLI or VS Code extension;
- stable public npm API guarantees;
- enterprise/commercial licensing features.

## Contributing

See `CONTRIBUTING.md` for development prerequisites, quality gates, architecture boundaries, tests, security expectations, and pull-request guidance.

## License

FlowLens source code is licensed under the **Apache License 2.0**. See `LICENSE`.

Third-party dependencies retain their upstream licenses. See `THIRD_PARTY_NOTICES.md` for the V0.1 production dependency license inventory.
