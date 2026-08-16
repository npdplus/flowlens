# Changelog

All notable changes to FlowLens are documented in this file.

## [Unreleased]

No unreleased product changes are recorded after the V0.1 release candidate.

## [0.1.0]

### Added

- Native FlowLens Workflow Definition V0.1 for JSON and YAML workflows.
- Canonical workflow model with explicit steps, transitions, conditions, statuses, and metadata.
- Structural validation and stable `FL####` diagnostics.
- Semantic validation for references, entry/terminal structure, reachability, cycles, self-loops, and related topology rules.
- Workflow analysis kept separate from validation outcomes.
- CodeMirror 6 JSON/YAML editor with local file opening.
- Automatic ELK layout and read-only React Flow visualization.
- Pan, zoom, fit view, semantic step/transition selection, and Inspector panels.
- Light and dark themes with theme-preference persistence only.
- Local SVG and PNG diagram export with filesystem-safe filenames.
- Five synthetic official workflow examples: Simple Sequential, Purchase Approval, CI/CD Deployment, AI Agent Workflow, and Incident Response.
- Unit, integration, E2E, browser-matrix, accessibility-baseline, performance, supply-chain, dependency-audit, license-inventory, and secret-scan verification for release readiness.

### Security

- Workflow conditions and metadata remain non-executable data.
- Untrusted workflow strings are rendered as text rather than raw HTML.
- Export strips unsafe embedded element/attribute classes and excludes non-fragment CSS resources.
- Core functionality remains local-first without workflow upload, workflow-content telemetry, AI services, a remote export renderer, or runtime secrets.

### Fixed

- Keyboard selection in the diagram now propagates the same semantic step/transition selection used by the Inspector, matching the diagram's accessibility instructions.
