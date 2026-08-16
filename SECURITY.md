# Security Policy

FlowLens treats workflow definitions, labels, conditions, metadata, files, and exported presentation content as untrusted data.

## Supported versions

Security fixes are provided for the current `0.1.x` release line while it remains the current supported release. Support policy may change in later releases and will be documented here.

## Reporting a vulnerability

Please report security vulnerabilities privately.

Use GitHub's **Report a vulnerability** / private security advisory interface when it is available for this repository. Do not publish exploit details, credentials, sensitive workflow content, or proof-of-concept payloads in a public issue.

If the private reporting interface is unavailable, open a public issue containing only a request for a private security contact channel. Do not include vulnerability details in that issue.

A useful private report includes:

- affected FlowLens version or commit;
- affected browser/platform where relevant;
- reproduction steps using synthetic data;
- security impact;
- proof-of-concept material that does not contain third-party secrets or private data;
- suggested mitigation if known.

## V0.1 security model

FlowLens V0.1 is a local-first browser tool. Core functionality does not require an account, backend, database, workflow upload, remote export renderer, AI service, workflow-content telemetry, or runtime secret.

The security boundary includes these commitments:

- workflow conditions are opaque text and are never evaluated;
- workflow metadata is data and is never executed;
- workflow content is not passed to `eval` or a Function constructor;
- untrusted workflow strings are rendered as text rather than raw HTML;
- URL/script-looking workflow strings do not become executable navigation or resources;
- YAML parsing does not use custom executable object constructors;
- diagram export is performed locally in the browser;
- exported SVG removes unsafe embedded element classes and URL/source/event-style attributes;
- non-fragment CSS `url(...)` resources are excluded from export styling;
- exported diagrams do not intentionally contain the complete canonical workflow object or hidden arbitrary workflow metadata;
- local workflow files are read in the browser and are not uploaded for core functionality;
- V0.1 persists theme preference only; workflow definition content is not persisted by the application.

## Scope limitations

FlowLens is not a sandbox for executing workflow logic because V0.1 does not execute workflow logic at all. A future feature that introduces execution, remote services, authentication, persistence, collaboration, external adapters, or AI integration would require a new security review and must not inherit V0.1 assumptions silently.

The project does not claim formal security certification or penetration-test certification unless such evidence is explicitly published.

## Dependency security

The repository uses a committed pnpm lockfile and frozen installation in CI. Release verification reviews dependency advisories, registry signatures, dependency licenses, and unexpected registry/tarball sources.

Please also report a dependency issue if it creates a practical vulnerability in FlowLens even when the upstream package has already published an advisory.
