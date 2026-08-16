# Third-Party Notices

FlowLens source code is licensed under Apache License 2.0. Third-party packages used by the application retain their own upstream licenses; the FlowLens license does not replace or relicense those packages.

This V0.1 inventory is generated from the committed production dependency graph with `pnpm licenses list --prod --json` and reviewed during release verification.

## MIT

The following production dependency records report the MIT license:

- `@codemirror/autocomplete` 6.20.3
- `@codemirror/commands` 6.10.4
- `@codemirror/lang-json` 6.0.2
- `@codemirror/lang-yaml` 6.1.3
- `@codemirror/language` 6.12.4
- `@codemirror/state` 6.7.1
- `@codemirror/view` 6.43.7
- `@lezer/common` 1.5.2
- `@lezer/highlight` 1.2.3
- `@lezer/json` 1.0.3
- `@lezer/lr` 1.4.10
- `@lezer/yaml` 1.0.4
- `@marijn/find-cluster-break` 1.0.3
- `@types/d3-color` 3.1.3
- `@types/d3-drag` 3.0.7
- `@types/d3-interpolate` 3.0.4
- `@types/d3-selection` 3.0.11
- `@types/d3-transition` 3.0.9
- `@types/d3-zoom` 3.0.8
- `@types/react` 19.2.18
- `@types/react-dom` 19.2.4
- `@xyflow/react` 12.11.2
- `@xyflow/system` 0.0.79
- `classcat` 5.0.5
- `crelt` 1.0.7
- `csstype` 3.2.3
- `js-yaml` 5.3.0
- `react` 19.2.8
- `react-dom` 19.2.8
- `scheduler` 0.27.0
- `style-mod` 4.1.3
- `use-sync-external-store` 1.6.0
- `w3c-keyname` 2.2.8
- `zod` 4.4.3
- `zustand` 4.5.7

## ISC

- `d3-color` 3.1.0
- `d3-dispatch` 3.0.1
- `d3-drag` 3.0.0
- `d3-interpolate` 3.0.1
- `d3-selection` 3.0.0
- `d3-timer` 3.0.1
- `d3-transition` 3.0.1
- `d3-zoom` 3.0.0

## BSD-3-Clause

- `d3-ease` 3.0.1

## Python-2.0

- `argparse` 2.0.1

`argparse` is a transitive dependency in the YAML parsing dependency graph. Its distribution includes the applicable Python Software Foundation license text and notices. Those upstream terms remain applicable to that package.

## EPL-2.0 OR GPL-3.0-or-later

- `elkjs` 0.12.0

FlowLens uses `elkjs` for automatic graph layout. For V0.1 dependency review, FlowLens relies on the **EPL-2.0** option of the package's dual-license expression. The upstream `elkjs` package and source distribution retain their original license and notices.

## Reproducing the inventory

From a clean installation of the committed lockfile:

```bash
pnpm install --frozen-lockfile
pnpm licenses list --prod --json
```

The package manager's output and the installed package license files are the authoritative package-level license materials. Version changes can change this inventory and require a new review.
