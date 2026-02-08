import type { ArmaModEntry, ArmaModList, DiffOptions, ModDiffResult } from "./types";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function defaultIdentityFn(mod: ArmaModEntry): string {
  if (mod.steamId) {
    return `steam:${mod.steamId}`;
  }
  return `name:${normalizeName(mod.displayName)}`;
}

function indexByIdentity(
  mods: ArmaModEntry[],
  identityFn: (mod: ArmaModEntry) => string
): Map<string, ArmaModEntry> {
  const indexed = new Map<string, ArmaModEntry>();
  for (const mod of mods) {
    const identity = identityFn(mod);
    if (!identity) {
      continue;
    }
    if (!indexed.has(identity)) {
      indexed.set(identity, mod);
    }
  }
  return indexed;
}

export function diffModLists(a: ArmaModList, b: ArmaModList, options: DiffOptions = {}): ModDiffResult {
  const identityFn = options.identityFn ?? defaultIdentityFn;
  const aByIdentity = indexByIdentity(a.mods, identityFn);
  const bByIdentity = indexByIdentity(b.mods, identityFn);

  const onlyInA: ArmaModEntry[] = [];
  const onlyInB: ArmaModEntry[] = [];
  const common: ArmaModEntry[] = [];

  for (const [identity, mod] of aByIdentity.entries()) {
    if (bByIdentity.has(identity)) {
      common.push(mod);
    } else {
      onlyInA.push(mod);
    }
  }

  for (const [identity, mod] of bByIdentity.entries()) {
    if (!aByIdentity.has(identity)) {
      onlyInB.push(mod);
    }
  }

  return {
    onlyInA,
    onlyInB,
    common
  };
}
