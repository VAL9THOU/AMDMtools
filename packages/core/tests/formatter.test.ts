import { describe, expect, it } from "vitest";
import { formatBytes, formatDiffResult, type ModDiffResult, type SizeContext } from "../src";

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

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(350_000_000)).toBe("333.8 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1 GB");
    expect(formatBytes(1_500_000_000)).toBe("1.4 GB");
  });

  it("strips trailing .0", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(1073741824)).toBe("1 GB");
  });

  it("handles zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
});

describe("formatDiffResult with size context", () => {
  const sizedDiff: ModDiffResult = {
    onlyInA: [
      {
        displayName: "Mod A",
        source: "steam",
        steamId: "100",
        steamUrl: "https://steamcommunity.com/sharedfiles/filedetails/?id=100"
      }
    ],
    onlyInB: [
      {
        displayName: "Mod B",
        source: "steam",
        steamId: "200",
        steamUrl: "https://steamcommunity.com/sharedfiles/filedetails/?id=200"
      }
    ],
    common: [
      {
        displayName: "Shared",
        source: "steam",
        steamId: "300",
        steamUrl: "https://steamcommunity.com/sharedfiles/filedetails/?id=300"
      }
    ]
  };

  const sizeContext: SizeContext = {
    sizes: {
      "100": 1_500_000_000,
      "200": 350_000_000,
      "300": 52_428_800
    },
    totalA: 2_000_000_000,
    totalB: 1_800_000_000
  };

  it("appends size to each mod line in plain format", () => {
    const result = formatDiffResult(sizedDiff, {
      format: "plain",
      includeLinks: false,
      sizeContext
    });
    expect(result.text).toContain("Mod A [1.4 GB]");
    expect(result.text).toContain("Mod B [333.8 MB]");
    expect(result.text).toContain("Shared [50 MB]");
  });

  it("appends section total to section header", () => {
    const result = formatDiffResult(sizedDiff, {
      format: "plain",
      includeLinks: false,
      sizeContext
    });
    expect(result.text).toContain("=== Only in File A (1) [1.4 GB] ===");
    expect(result.text).toContain("=== Only in File B (1) [333.8 MB] ===");
  });

  it("appends modlist total footer for onlyInA and onlyInB sections", () => {
    const result = formatDiffResult(sizedDiff, {
      format: "plain",
      includeLinks: false,
      sizeContext,
      sections: ["onlyInA", "onlyInB"]
    });
    expect(result.text).toContain("[1.9 GB]");
    expect(result.text).toContain("[1.7 GB]");
  });

  it("does not append modlist total footer for common section", () => {
    const result = formatDiffResult(sizedDiff, {
      format: "plain",
      includeLinks: false,
      sizeContext,
      sections: ["common"]
    });
    const lines = result.text.split("\n");
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toBe("Shared [50 MB]");
  });

  it("includes size footer when provided", () => {
    const result = formatDiffResult(sizedDiff, {
      format: "plain",
      includeLinks: false,
      sizeContext,
      sizeFooter: "1.9 GB -> 1.7 GB"
    });
    expect(result.text).toContain("1.9 GB -> 1.7 GB");
  });

  it("discord format includes sizes with bold headers", () => {
    const result = formatDiffResult(sizedDiff, {
      format: "discord",
      includeLinks: false,
      sizeContext
    });
    expect(result.text).toContain("**Only in File A (1) [1.4 GB]**");
    expect(result.text).toContain("- Mod A [1.4 GB]");
  });

  it("omits sizes when sizeContext is undefined", () => {
    const result = formatDiffResult(sizedDiff, {
      format: "plain",
      includeLinks: false
    });
    expect(result.text).not.toContain("[");
    expect(result.text).not.toContain("GB");
    expect(result.text).not.toContain("MB");
  });

  it("skips size for mods without steamId in sizeContext", () => {
    const diffWithLocal: ModDiffResult = {
      onlyInA: [
        { displayName: "Local Mod", source: "local", steamId: null, steamUrl: null }
      ],
      onlyInB: [],
      common: []
    };
    const result = formatDiffResult(diffWithLocal, {
      format: "plain",
      includeLinks: false,
      sizeContext
    });
    // The mod line itself should not have a size bracket
    const lines = result.text.split("\n");
    const modLine = lines.find((l) => l.includes("Local Mod"));
    expect(modLine).toBe("Local Mod");
  });
});
