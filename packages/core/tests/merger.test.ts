import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeModLists, parseModList } from "../src";

function readFixture(fileName: string): string {
  return readFileSync(new URL(`../../../test-fixtures/${fileName}`, import.meta.url), "utf-8");
}

describe("mergeModLists", () => {
  it("deduplicates by identity and round-trips through parser", () => {
    const source = parseModList(readFixture("Arma 3 Preset 4th MEU V8.html"));
    const mods = [
      source.mods[0],
      source.mods[1],
      source.mods[0],
      {
        displayName: "Client Local Utility",
        source: "local" as const,
        steamId: null,
        steamUrl: null
      }
    ];

    const mergedHtml = mergeModLists(mods, {
      name: "Merged Test Preset",
      type: "preset"
    });
    const parsedMerged = parseModList(mergedHtml);

    expect(parsedMerged.type).toBe("preset");
    expect(parsedMerged.name).toBe("Merged Test Preset");
    expect(parsedMerged.mods).toHaveLength(3);
    expect(parsedMerged.mods.some((mod) => mod.displayName === "Client Local Utility")).toBe(true);
  });

  it("supports list output mode and expected arma html structure", () => {
    const source = parseModList(readFixture("16th_Savlarian_V2.html"));
    const mergedHtml = mergeModLists(source.mods.slice(0, 2), {
      name: "Merged Modlist",
      type: "list"
    });

    expect(mergedHtml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(mergedHtml).toContain('<meta name="arma:Type" content="list" />');
    expect(mergedHtml).toContain('<tr data-type="ModContainer">');
    expect(mergedHtml).toContain('<td data-type="DisplayName">');
    expect(mergedHtml).not.toContain('name="arma:PresetName"');
  });

  it("throws when merge options are invalid", () => {
    expect(() =>
      mergeModLists([], {
        name: "   ",
        type: "preset"
      })
    ).toThrow("non-empty string");
  });
});
