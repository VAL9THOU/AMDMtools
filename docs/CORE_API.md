# Core API Reference (`@arma-modlist-diff/core`)

This document describes the public API for the reusable core module in `packages/core`.

## Install

Published install target (when released):

```bash
npm install @arma-modlist-diff/core
```

Current local workspace install:

```bash
npm install ./packages/core
```

## Public exports

From `packages/core/src/index.ts`:

- `parseModList`
- `diffModLists`
- `defaultIdentityFn`
- `mergeModLists`
- `formatDiffResult`
- `serializeModList`
- `deserializeModList`
- `ArmaHtmlParser`
- `ModListParser` (type)
- Core type exports (`ArmaModEntry`, `ArmaModList`, `ModDiffResult`, etc.)

## Core types

```ts
type ModSource = "steam" | "local";

interface ArmaModEntry {
  displayName: string;
  steamId: string | null;
  steamUrl: string | null;
  source: ModSource;
}

interface ArmaModList {
  name: string | null;
  type: "preset" | "list";
  mods: ArmaModEntry[];
}

interface ModDiffResult {
  onlyInA: ArmaModEntry[];
  onlyInB: ArmaModEntry[];
  common: ArmaModEntry[];
}
```

## Functions

### `parseModList(input: string, parser?: ModListParser): ArmaModList`

- Parses a modlist/preset input string into normalized data.
- Defaults to `ArmaHtmlParser` when `parser` is omitted.

### `diffModLists(a: ArmaModList, b: ArmaModList, options?: DiffOptions): ModDiffResult`

- Computes `onlyInA`, `onlyInB`, and `common`.
- Default identity strategy:
  - Steam mods: `steam:<steamId>`
  - Local/no-id mods: `name:<normalizedDisplayName>`
- Override with `options.identityFn`.

### `defaultIdentityFn(mod: ArmaModEntry): string`

- Exposes the default matching strategy used by `diffModLists`.

### `mergeModLists(mods: ArmaModEntry[], options: MergeOptions): string`

- Deduplicates mods and returns Arma-launcher-importable HTML.
- `options`:
  - `name: string`
  - `type: "preset" | "list"`

### `formatDiffResult(diff: ModDiffResult, options: FormatOptions): FormatResult`

- Formats diff output in one of:
  - `"plain"`
  - `"discord"`
  - `"html-links"`
- Returns:
  - `text: string`
  - `parts: string[]` (Discord-safe split output when needed)
  - `characterCount: number`
- Pass `rawString: true` to return only `string`.

### `serializeModList(list: ArmaModList): string`

- Produces versioned JSON payload (schema version `1`).

### `deserializeModList(json: string): ArmaModList`

- Parses and validates serialized JSON payload.
- Throws descriptive errors on schema mismatch.

## Usage examples

### 1) Basic parse + diff + format

```ts
import { parseModList, diffModLists, formatDiffResult } from "@arma-modlist-diff/core";

const parsedA = parseModList(htmlA);
const parsedB = parseModList(htmlB);
const diff = diffModLists(parsedA, parsedB);

const output = formatDiffResult(diff, {
  format: "discord",
  includeLinks: true,
  nameA: parsedA.name ?? "File A",
  nameB: parsedB.name ?? "File B",
  sections: ["onlyInA", "onlyInB"]
});

console.log(output.text);
```

### 2) Custom parser implementation

```ts
import type { ArmaModList, ModListParser } from "@arma-modlist-diff/core";
import { parseModList } from "@arma-modlist-diff/core";

class JsonListParser implements ModListParser {
  parse(input: string): ArmaModList {
    const parsed = JSON.parse(input) as ArmaModList;
    return parsed;
  }
}

const list = parseModList(jsonInput, new JsonListParser());
```

### 3) Custom identity function

Use this when you want matching by display name only:

```ts
import { diffModLists } from "@arma-modlist-diff/core";

const diff = diffModLists(listA, listB, {
  identityFn: (mod) => mod.displayName.trim().toLowerCase()
});
```

### 4) Serialization round-trip

```ts
import { serializeModList, deserializeModList } from "@arma-modlist-diff/core";

const json = serializeModList(parsedList);
const restored = deserializeModList(json);
```

### 5) Merge selected mods to launcher HTML

```ts
import { mergeModLists } from "@arma-modlist-diff/core";

const mergedHtml = mergeModLists(selectedMods, {
  name: "Merged Preset",
  type: "preset"
});
```

## Notes for consumers

- `parseModList` and `ArmaHtmlParser` are framework-agnostic and run in browser or Node.
- Core module does not depend on React or DOM APIs.
- This package is currently private in this repository to avoid accidental publish.
