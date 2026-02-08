import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deserializeModList, parseModList, serializeModList } from "../src";

function readFixture(fileName: string): string {
  return readFileSync(new URL(`../../../test-fixtures/${fileName}`, import.meta.url), "utf-8");
}

describe("serializeModList / deserializeModList", () => {
  it("round-trips an Arma mod list", () => {
    const parsed = parseModList(readFixture("Arma 3 Preset 4th MEU V8.html"));
    const json = serializeModList(parsed);
    const restored = deserializeModList(json);

    expect(restored.type).toBe(parsed.type);
    expect(restored.name).toBe(parsed.name);
    expect(restored.mods).toHaveLength(parsed.mods.length);
    expect(restored.mods[0]).toEqual(parsed.mods[0]);
  });

  it("throws on invalid json", () => {
    expect(() => deserializeModList("{not valid json")).toThrow("Invalid JSON");
  });

  it("throws on unsupported schema version", () => {
    const payload = JSON.stringify({
      version: 2,
      list: {
        name: null,
        type: "list",
        mods: []
      }
    });

    expect(() => deserializeModList(payload)).toThrow("Unsupported schema version");
  });

  it("throws on schema mismatch", () => {
    const payload = JSON.stringify({
      version: 1,
      list: {
        name: null,
        type: "list",
        mods: [
          {
            displayName: "Broken",
            source: "steamish",
            steamId: null,
            steamUrl: null
          }
        ]
      }
    });

    expect(() => deserializeModList(payload)).toThrow('source must be "steam" or "local"');
  });
});
