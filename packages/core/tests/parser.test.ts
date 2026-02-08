import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ArmaHtmlParser, parseModList } from "../src";

const parser = new ArmaHtmlParser();

function readFixture(fileName: string): string {
  return readFileSync(new URL(`../../../test-fixtures/${fileName}`, import.meta.url), "utf-8");
}

describe("ArmaHtmlParser", () => {
  it("parses preset metadata and mods from the 4th MEU fixture", () => {
    const html = readFixture("Arma 3 Preset 4th MEU V8.html");
    const list = parser.parse(html);

    expect(list.type).toBe("preset");
    expect(list.name).toBe("4th MEU V8");
    expect(list.mods).toHaveLength(99);

    const cba = list.mods.find((mod) => mod.displayName === "CBA_A3");
    expect(cba).toBeDefined();
    expect(cba?.steamId).toBe("450814997");
    expect(cba?.source).toBe("steam");
  });

  it("parses list metadata and decodes html entities", () => {
    const html = readFixture("16th_Savlarian_V2.html");
    const list = parser.parse(html);

    expect(list.type).toBe("list");
    expect(list.name).toBeNull();
    expect(list.mods).toHaveLength(141);

    const entityMod = list.mods.find((mod) => mod.displayName === "Add & Remove Map Labels");
    expect(entityMod).toBeDefined();
  });

  it("throws on empty html input", () => {
    expect(() => parser.parse("   \n\t")).toThrow("Input HTML is empty");
  });

  it("throws on unsupported or malformed html input", () => {
    const malformed = "<html><body><table></table></body></html>";
    expect(() => parser.parse(malformed)).toThrow("arma:Type");
  });

  it("parses local-only mods without a steam id", () => {
    const localOnly = `<?xml version="1.0" encoding="utf-8"?>
<html>
  <head>
    <meta name="arma:Type" content="list" />
  </head>
  <body>
    <table>
      <tr data-type="ModContainer">
        <td data-type="DisplayName">Local Utility Pack</td>
        <td><span class="from-local">Local</span></td>
        <td></td>
      </tr>
    </table>
  </body>
</html>`;

    const list = parseModList(localOnly);
    expect(list.mods).toHaveLength(1);
    expect(list.mods[0]).toEqual({
      displayName: "Local Utility Pack",
      source: "local",
      steamId: null,
      steamUrl: null
    });
  });

  it("handles files with no mods", () => {
    const noMods = `<?xml version="1.0" encoding="utf-8"?>
<html>
  <head>
    <meta name="arma:Type" content="list" />
  </head>
  <body>
    <div class="mod-list"><table></table></div>
  </body>
</html>`;

    const parsed = parseModList(noMods);
    expect(parsed.mods).toEqual([]);
    expect(parsed.type).toBe("list");
  });
});
