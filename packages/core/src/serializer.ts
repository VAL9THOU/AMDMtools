import type { ArmaModEntry, ArmaModList } from "./types";

interface SerializedModListV1 {
  version: 1;
  list: ArmaModList;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertStringOrNull(value: unknown, path: string): asserts value is string | null {
  if (value !== null && typeof value !== "string") {
    throw new Error(`${path} must be a string or null.`);
  }
}

function assertModEntry(value: unknown, index: number): asserts value is ArmaModEntry {
  if (!isObject(value)) {
    throw new Error(`mods[${index}] must be an object.`);
  }

  if (typeof value.displayName !== "string" || !value.displayName.trim()) {
    throw new Error(`mods[${index}].displayName must be a non-empty string.`);
  }

  assertStringOrNull(value.steamId, `mods[${index}].steamId`);
  assertStringOrNull(value.steamUrl, `mods[${index}].steamUrl`);

  if (value.source !== "steam" && value.source !== "local") {
    throw new Error(`mods[${index}].source must be "steam" or "local".`);
  }
}

function assertArmaModList(value: unknown): asserts value is ArmaModList {
  if (!isObject(value)) {
    throw new Error("list must be an object.");
  }

  assertStringOrNull(value.name, "list.name");

  if (value.type !== "preset" && value.type !== "list") {
    throw new Error('list.type must be "preset" or "list".');
  }

  if (!Array.isArray(value.mods)) {
    throw new Error("list.mods must be an array.");
  }

  value.mods.forEach((mod, index) => assertModEntry(mod, index));
}

export function serializeModList(list: ArmaModList): string {
  const payload: SerializedModListV1 = {
    version: 1,
    list: {
      name: list.name,
      type: list.type,
      mods: list.mods.map((mod) => ({
        displayName: mod.displayName,
        steamId: mod.steamId,
        steamUrl: mod.steamUrl,
        source: mod.source
      }))
    }
  };

  return JSON.stringify(payload);
}

export function deserializeModList(json: string): ArmaModList {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON.");
  }

  if (!isObject(parsed)) {
    throw new Error("Serialized payload must be an object.");
  }

  if (parsed.version !== 1) {
    throw new Error("Unsupported schema version. Expected version 1.");
  }

  assertArmaModList(parsed.list);
  return parsed.list;
}
