import { describe, expect, it } from "vitest";
import { formatDiffResult, type ModDiffResult } from "../src";

const sampleDiff: ModDiffResult = {
  onlyInA: [
    {
      displayName: "Only A Steam",
      source: "steam",
      steamId: "111",
      steamUrl: "https://steamcommunity.com/sharedfiles/filedetails/?id=111"
    }
  ],
  onlyInB: [
    {
      displayName: "Only B Local",
      source: "local",
      steamId: null,
      steamUrl: null
    }
  ],
  common: [
    {
      displayName: "Shared Steam",
      source: "steam",
      steamId: "222",
      steamUrl: "https://steamcommunity.com/sharedfiles/filedetails/?id=222"
    }
  ]
};

describe("formatDiffResult", () => {
  it("formats plain output with section headers", () => {
    const result = formatDiffResult(sampleDiff, {
      format: "plain",
      includeLinks: false,
      nameA: "List A",
      nameB: "List B"
    });

    expect(result.text).toContain("=== Only in List A (1) ===");
    expect(result.text).toContain("Only A Steam");
    expect(result.text).toContain("=== Common Mods (1) ===");
    expect(result.parts).toHaveLength(1);
    expect(result.characterCount).toBe(result.text.length);
  });

  it("formats discord output with markdown links and keeps local mods plain", () => {
    const result = formatDiffResult(sampleDiff, {
      format: "discord",
      includeLinks: true
    });

    expect(result.text).toContain("**Only in File A (1)**");
    expect(result.text).toContain("[Only A Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=111)");
    expect(result.text).toContain("- Only B Local");
  });

  it("supports overriding section labels for directional UI wording", () => {
    const result = formatDiffResult(sampleDiff, {
      format: "plain",
      includeLinks: false,
      sections: ["onlyInA", "onlyInB"],
      sectionLabels: {
        onlyInA: "Removed",
        onlyInB: "Added"
      }
    });

    expect(result.text).toContain("=== Removed (1) ===");
    expect(result.text).toContain("=== Added (1) ===");
    expect(result.text).not.toContain("Common Mods");
  });

  it("splits discord output into labeled parts when above message limit", () => {
    const longDiff: ModDiffResult = {
      onlyInA: Array.from({ length: 12 }, (_, index) => ({
        displayName: `Super Long Mod Name ${index} ${"X".repeat(30)}`,
        source: "local" as const,
        steamId: null,
        steamUrl: null
      })),
      onlyInB: [],
      common: []
    };

    const result = formatDiffResult(longDiff, {
      format: "discord",
      includeLinks: false,
      discordLimit: 120
    });

    expect(result.parts.length).toBeGreaterThan(1);
    expect(result.parts[0]).toContain("Part 1/");
  });

  it("returns a raw string when rawString is true", () => {
    const result = formatDiffResult(sampleDiff, {
      format: "html-links",
      includeLinks: true,
      rawString: true
    });

    expect(typeof result).toBe("string");
    expect(result).toContain("<a href=");
  });
});
