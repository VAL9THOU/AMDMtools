import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diffModLists, parseModList, type ArmaModList } from "../src";

function readFixture(fileName: string): string {
  return readFileSync(new URL(`../../../test-fixtures/${fileName}`, import.meta.url), "utf-8");
}

function listWithNames(names: string[]): ArmaModList {
  return {
    name: null,
    type: "list",
    mods: names.map((displayName) => ({
      displayName,
      source: "local",
      steamId: null,
      steamUrl: null
    }))
  };
}

describe("diffModLists", () => {
  it("diffs the provided fixtures with expected counts", () => {
    const a = parseModList(readFixture("Arma 3 Preset 4th MEU V8.html"));
    const b = parseModList(readFixture("16th_Savlarian_V2.html"));
    const diff = diffModLists(a, b);

    expect(diff.onlyInA).toHaveLength(46);
    expect(diff.onlyInB).toHaveLength(88);
    expect(diff.common).toHaveLength(53);

    expect(diff.onlyInA.some((mod) => mod.displayName === "Operation TREBUCHET")).toBe(true);
    expect(diff.onlyInB.some((mod) => mod.displayName === "(TIOW) Space Marine Melee")).toBe(true);
    expect(diff.common.some((mod) => mod.displayName === "CBA_A3")).toBe(true);
  });

  it("returns all mods as common for identical lists", () => {
    const a = listWithNames(["Alpha", "Bravo"]);
    const b = listWithNames(["Alpha", "Bravo"]);
    const diff = diffModLists(a, b);

    expect(diff.onlyInA).toEqual([]);
    expect(diff.onlyInB).toEqual([]);
    expect(diff.common).toHaveLength(2);
  });

  it("handles disjoint lists", () => {
    const a = listWithNames(["Only A 1", "Only A 2"]);
    const b = listWithNames(["Only B 1"]);
    const diff = diffModLists(a, b);

    expect(diff.onlyInA).toHaveLength(2);
    expect(diff.onlyInB).toHaveLength(1);
    expect(diff.common).toEqual([]);
  });

  it("handles empty lists", () => {
    const emptyA = listWithNames([]);
    const emptyB = listWithNames([]);
    const diff = diffModLists(emptyA, emptyB);
    expect(diff).toEqual({
      onlyInA: [],
      onlyInB: [],
      common: []
    });
  });

  it("supports custom identity functions", () => {
    const a: ArmaModList = {
      name: null,
      type: "list",
      mods: [
        {
          displayName: "Special Mod",
          source: "steam",
          steamId: "111",
          steamUrl: "https://steamcommunity.com/sharedfiles/filedetails/?id=111"
        }
      ]
    };
    const b: ArmaModList = {
      name: null,
      type: "list",
      mods: [
        {
          displayName: "special mod",
          source: "steam",
          steamId: "222",
          steamUrl: "https://steamcommunity.com/sharedfiles/filedetails/?id=222"
        }
      ]
    };

    const byDisplayName = diffModLists(a, b, {
      identityFn: (mod) => mod.displayName.toLowerCase()
    });

    expect(byDisplayName.common).toHaveLength(1);
    expect(byDisplayName.onlyInA).toHaveLength(0);
    expect(byDisplayName.onlyInB).toHaveLength(0);
  });
});
