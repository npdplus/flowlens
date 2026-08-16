# Contributing to FlowLens

Thanks for helping improve FlowLens.

FlowLens is an **NPD PLUS Labs / Experimental Open-source** project. Contributions should preserve the V0.1 architecture: workflow semantics live in Core, rendering consumes those semantics, and the browser application composes the user experience without redefining workflow validity.

## Development prerequisites

- Node.js `24.18.0`
- pnpm `11.4.0`

Activate the pinned package manager:

```bash
corepack enable
corepack prepare pnpm@11.4.0 --activate
```

Install exactly from the committed lockfile:

```bash
pnpm install --frozen-lockfile
```

Run the web application:

```bash
pnpm dev
```

## Repository quality gates

Before opening a pull request, run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

For browser tests on a fresh machine:

```bash
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

After Chromium is installed, the normal combined gate is:

```bash
pnpm verify
```

Release-oriented browser and performance suites exist for maintainers and may be run when a change affects rendering, accessibility, export, browser behavior, or performance.

## Architecture boundaries

The primary dependency direction is:

```text
packages/core
      ↑
packages/react
      ↑
apps/web
```

Direct `apps/web → packages/core` consumption is allowed.

### Core rules

`packages/core` owns workflow semantics and must remain framework-independent.

Do not add React, React Flow, ELK, DOM APIs, browser storage, export code, application state, or product-specific UI behavior to Core.

Core changes should preserve the established separation between:

1. parsing;
2. structural validation;
3. normalization;
4. semantic validation;
5. workflow analysis.

Do not silently repair invalid input during normalization. Conditions are opaque strings and must never be executed.

### Renderer rules

`packages/react` may depend on Core and rendering/layout libraries. It must consume canonical workflow semantics rather than parse raw JSON/YAML or invent validation rules.

The V0.1 canvas is read-only with respect to workflow semantics. Pan, zoom, fit, focus, and selection must not mutate the workflow definition.

### Web application rules

`apps/web` owns application composition such as the editor, diagnostics presentation, Inspector, examples, theme preference, and export controls.

Examples must use the same production processing pipeline as user-authored workflow text.

## Security and privacy expectations

Treat all workflow content as untrusted.

Changes must not introduce:

- `eval` or Function-constructor execution of workflow content;
- condition or metadata execution;
- raw untrusted HTML rendering;
- workflow-driven script or executable SVG injection;
- silent workflow uploads or workflow-content telemetry;
- runtime secrets for core functionality;
- remote export rendering without an explicit architecture change.

Security-sensitive changes should include regression coverage. See `SECURITY.md` for reporting vulnerabilities.

## Tests

Add tests at the lowest appropriate layer:

- unit tests for isolated Core/renderer/application behavior;
- integration tests for cross-package contracts and production-path composition;
- browser tests for user-visible interaction, file handling, export, accessibility, and local-only behavior.

Prefer synthetic fixtures. Do not commit customer, employee, production, credential, or other sensitive data as examples or tests.

## Documentation

When behavior changes, update the relevant public documentation in the same pull request. Public claims about browser support, security, performance, or compatibility must be backed by actual evidence.

## Pull requests

Keep pull requests focused and reviewable. A good pull request should:

- explain the problem and scope;
- avoid unrelated refactors;
- preserve package boundaries;
- include appropriate tests;
- pass the repository quality gates;
- call out security/privacy impact when relevant;
- document user-visible changes or limitations.

Changes that intentionally alter the workflow contract, canonical model, validation semantics, local-first design, or other architectural commitments should be discussed explicitly rather than introduced as incidental implementation details.

## License

By contributing, you agree that your contribution is submitted under the repository's Apache License 2.0 terms unless a different arrangement is explicitly documented for that contribution.
