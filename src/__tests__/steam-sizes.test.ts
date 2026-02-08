import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeModlistTotal } from "../steam-sizes";
import type { ArmaModEntry } from "../../packages/core/src";

describe("computeModlistTotal", () => {
  it("sums sizes for mods with known sizes", () => {
    const mods: ArmaModEntry[] = [
      { displayName: "A", source: "steam", steamId: "1", steamUrl: null },
      { displayName: "B", source: "steam", steamId: "2", steamUrl: null },
      { displayName: "C", source: "local", steamId: null, steamUrl: null }
    ];
    const sizes = { "1": 1000, "2": 2000 };
    expect(computeModlistTotal(mods, sizes)).toBe(3000);
  });

  it("returns 0 when no sizes match", () => {
    const mods: ArmaModEntry[] = [
      { displayName: "A", source: "local", steamId: null, steamUrl: null }
    ];
    expect(computeModlistTotal(mods, {})).toBe(0);
  });

  it("returns 0 for empty mod list", () => {
    expect(computeModlistTotal([], { "1": 5000 })).toBe(0);
  });

  it("ignores mods whose steamId is not in sizes", () => {
    const mods: ArmaModEntry[] = [
      { displayName: "A", source: "steam", steamId: "1", steamUrl: null },
      { displayName: "B", source: "steam", steamId: "999", steamUrl: null }
    ];
    const sizes = { "1": 5000 };
    expect(computeModlistTotal(mods, sizes)).toBe(5000);
  });
});
