# @arma-modlist-diff/core

Core parsing, diffing, formatting, merging, and serialization utilities for Arma 3 Launcher HTML preset/modlist exports.

## Install

```bash
npm install @arma-modlist-diff/core
```

## Quick Start

```ts
import {
  parseModList,
  diffModLists,
  formatDiffResult,
  mergeModLists
} from "@arma-modlist-diff/core";

const listA = parseModList(htmlA);
const listB = parseModList(htmlB);
const diff = diffModLists(listA, listB);

const output = formatDiffResult(diff, {
  format: "discord",
  includeLinks: true,
  nameA: listA.name ?? "File A",
  nameB: listB.name ?? "File B",
  sections: ["onlyInA", "onlyInB"]
});

// Arma-launcher-importable HTML
const mergedHtml = mergeModLists(
  [...diff.common, ...diff.onlyInA, ...diff.onlyInB],
  { name: "Merged Preset", type: "preset" }
);

console.log(output.text);
```

## API Overview

- `parseModList(html, parser?)`: Parse Arma HTML into a typed `ArmaModList`.
- `diffModLists(a, b, options?)`: Return `{ onlyInA, onlyInB, common }`.
- `formatDiffResult(diff, options)`: Format as `plain`, `discord`, or `html-links`.
- `mergeModLists(mods, options)`: Generate deduplicated Arma HTML (`preset` or `list`).
- `serializeModList(list)` / `deserializeModList(json)`: Stable JSON serialization with validation.
- `defaultIdentityFn(mod)`: Default diff identity strategy (Steam ID first, safe fallback).

## Formatter Behavior

- `formatDiffResult` returns:
  - `text`: full output string
  - `parts`: split output parts (Discord-safe chunking)
  - `characterCount`: total output length
- For simple usage, pass `rawString: true` to return only the `text` string.

## TypeScript

This package ships declaration files and supports both ESM and CommonJS consumers through the `exports` map.

## License

MIT
