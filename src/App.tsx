import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import {
  defaultIdentityFn,
  diffModLists,
  formatBytes,
  formatDiffResult,
  mergeModLists,
  parseModList,
  type ArmaModEntry,
  type ArmaModList,
  type DiffSectionKey,
  type ModDiffResult,
  type ModSizeMap,
  type OutputFormat,
  type SizeContext
} from "../packages/core/src";
import { useModSizes } from "./use-mod-sizes";

const ALL_SECTIONS: DiffSectionKey[] = ["onlyInA", "onlyInB", "common"];
const OUTPUT_SECTIONS: DiffSectionKey[] = ["onlyInA", "onlyInB"];

type LoadedFile = {
  fileName: string;
  parsed: ArmaModList;
};

type SelectionState = Record<string, boolean>;
type MergeType = "preset" | "list";
type SortOption = "default" | "a-z" | "z-a" | "size-desc" | "size-asc";

type OutputSnapshot = {
  text: string;
  parts: string[];
  characterCount: number;
};

function modKey(section: DiffSectionKey, mod: ArmaModEntry): string {
  return `${section}:${defaultIdentityFn(mod)}`;
}

function sumSectionSize(mods: ArmaModEntry[], sizes: ModSizeMap): number {
  let total = 0;
  for (const mod of mods) {
    if (mod.steamId && mod.steamId in sizes) {
      total += sizes[mod.steamId];
    }
  }
  return total;
}

function sortMods(mods: ArmaModEntry[], sort: SortOption, sizes?: ModSizeMap): ArmaModEntry[] {
  if (sort === "default") return mods;
  const sorted = [...mods];
  switch (sort) {
    case "a-z":
      sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
      break;
    case "z-a":
      sorted.sort((a, b) => b.displayName.localeCompare(a.displayName));
      break;
    case "size-desc":
      sorted.sort((a, b) => {
        const sA = (a.steamId && sizes?.[a.steamId]) || 0;
        const sB = (b.steamId && sizes?.[b.steamId]) || 0;
        return sB - sA;
      });
      break;
    case "size-asc":
      sorted.sort((a, b) => {
        const sA = (a.steamId && sizes?.[a.steamId]) || 0;
        const sB = (b.steamId && sizes?.[b.steamId]) || 0;
        return sA - sB;
      });
      break;
  }
  return sorted;
}

function baseSectionLabels(
  fileA: LoadedFile,
  fileB: LoadedFile,
  currentSlot: "A" | "B" | null
): Record<DiffSectionKey, string> {
  if (currentSlot === "A") {
    return {
      onlyInA: "Added",
      onlyInB: "Removed",
      common: "Common Mods"
    };
  }

  if (currentSlot === "B") {
    return {
      onlyInA: "Removed",
      onlyInB: "Added",
      common: "Common Mods"
    };
  }

  return {
    onlyInA: `Only in ${fileA.parsed.name ?? fileA.fileName}`,
    onlyInB: `Only in ${fileB.parsed.name ?? fileB.fileName}`,
    common: "Common Mods"
  };
}

function copyWithFallback(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      const copied = document.execCommand("copy");
      if (!copied) {
        reject(new Error("Clipboard copy command failed."));
        return;
      }
      resolve();
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Clipboard copy command failed."));
    } finally {
      document.body.removeChild(textarea);
    }
  });
}

export function App() {
  const [fileA, setFileA] = useState<LoadedFile | null>(null);
  const [fileB, setFileB] = useState<LoadedFile | null>(null);
  const [isParsingA, setIsParsingA] = useState(false);
  const [isParsingB, setIsParsingB] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState<"A" | "B" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [currentSlot, setCurrentSlot] = useState<"A" | "B" | null>(null);
  const [includedByKey, setIncludedByKey] = useState<SelectionState>({});
  const [showAsHyperlinks, setShowAsHyperlinks] = useState(false);
  const [formatForDiscord, setFormatForDiscord] = useState(false);
  const [mergeByKey, setMergeByKey] = useState<SelectionState>({});
  const [mergeName, setMergeName] = useState("Merged Preset");
  const [mergeType, setMergeType] = useState<MergeType>("preset");
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);
  const [includeSizes, setIncludeSizes] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("default");

  const modSizes = useModSizes(
    fileA?.parsed.mods ?? null,
    fileB?.parsed.mods ?? null,
    includeSizes
  );

  const setParsingState = (slot: "A" | "B", value: boolean) => {
    if (slot === "A") {
      setIsParsingA(value);
    } else {
      setIsParsingB(value);
    }
  };

  const loadFileIntoSlot = (slot: "A" | "B", file: File) => {
    void (async () => {
      try {
        setParsingState(slot, true);
        setError(null);
        setCopyStatus(null);
        setMergeStatus(null);
        const parsed = parseModList(await file.text());
        const payload: LoadedFile = { fileName: file.name, parsed };

        if (slot === "A") {
          setFileA(payload);
        } else {
          setFileB(payload);
        }
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : "Unknown parsing error.";
        setError(`Failed to parse ${file.name}: ${message}`);
      } finally {
        setParsingState(slot, false);
      }
    })();
  };

  const rawDiff = useMemo(() => {
    if (!fileA || !fileB) {
      return null;
    }
    return diffModLists(fileA.parsed, fileB.parsed);
  }, [fileA, fileB]);

  useEffect(() => {
    if (!rawDiff) {
      setIncludedByKey({});
      return;
    }

    const nextState: SelectionState = {};
    for (const section of ALL_SECTIONS) {
      for (const mod of rawDiff[section]) {
        nextState[modKey(section, mod)] = true;
      }
    }
    setIncludedByKey(nextState);
  }, [rawDiff]);

  useEffect(() => {
    if (!rawDiff) {
      setMergeByKey({});
      return;
    }

    const nextState: SelectionState = {};
    for (const section of ["onlyInA", "onlyInB"] as const) {
      for (const mod of rawDiff[section]) {
        nextState[modKey(section, mod)] = true;
      }
    }
    setMergeByKey(nextState);
  }, [rawDiff]);

  const filteredDiff = useMemo<ModDiffResult | null>(() => {
    if (!rawDiff) {
      return null;
    }

    const filterSection = (section: DiffSectionKey): ArmaModEntry[] =>
      rawDiff[section].filter((mod) => includedByKey[modKey(section, mod)] !== false);

    return {
      onlyInA: filterSection("onlyInA"),
      onlyInB: filterSection("onlyInB"),
      common: filterSection("common")
    };
  }, [rawDiff, includedByKey]);

  const sectionLabels = useMemo(() => {
    if (!fileA || !fileB) {
      return null;
    }
    return baseSectionLabels(fileA, fileB, currentSlot);
  }, [fileA, fileB, currentSlot]);

  const rawHasDifferences = useMemo(() => {
    if (!rawDiff) {
      return false;
    }
    return rawDiff.onlyInA.length > 0 || rawDiff.onlyInB.length > 0;
  }, [rawDiff]);

  const filteredHasDifferences = useMemo(() => {
    if (!filteredDiff) {
      return false;
    }
    return filteredDiff.onlyInA.length > 0 || filteredDiff.onlyInB.length > 0;
  }, [filteredDiff]);

  const outputEmptyMessage = useMemo(() => {
    if (!fileA || !fileB || !filteredDiff) {
      return "Upload both files to compare. Uncheck optional mods to exclude them from copy output.";
    }

    if (!rawHasDifferences) {
      return "No differences found.";
    }

    if (!filteredHasDifferences) {
      return "All differing mods are currently excluded. Re-enable mods to generate output.";
    }

    return "";
  }, [fileA, fileB, filteredDiff, rawHasDifferences, filteredHasDifferences]);

  const sizeContext = useMemo<SizeContext | undefined>(() => {
    if (!includeSizes || modSizes.loading || Object.keys(modSizes.sizes).length === 0) {
      return undefined;
    }
    return {
      sizes: modSizes.sizes,
      totalA: modSizes.totalA,
      totalB: modSizes.totalB
    };
  }, [includeSizes, modSizes.loading, modSizes.sizes, modSizes.totalA, modSizes.totalB]);

  const sizeFooter = useMemo<string | undefined>(() => {
    if (!sizeContext || !currentSlot) return undefined;

    const currentTotal = currentSlot === "A" ? sizeContext.totalA : sizeContext.totalB;
    const otherTotal = currentSlot === "A" ? sizeContext.totalB : sizeContext.totalA;

    return `${formatBytes(currentTotal ?? 0)} -> ${formatBytes(otherTotal ?? 0)}`;
  }, [sizeContext, currentSlot]);

  const buildEmptySnapshot = (message: string): OutputSnapshot => ({
    text: message,
    parts: [message],
    characterCount: message.length
  });

  const formattedOutput = useMemo(() => {
    if (!fileA || !fileB || !filteredDiff || !sectionLabels) {
      return null;
    }

    if (filteredDiff.onlyInA.length === 0 && filteredDiff.onlyInB.length === 0) {
      return buildEmptySnapshot(outputEmptyMessage || "No differences found.");
    }

    const format: OutputFormat = formatForDiscord
      ? "discord"
      : showAsHyperlinks
        ? "html-links"
        : "plain";

    return formatDiffResult(filteredDiff, {
      format,
      includeLinks: showAsHyperlinks,
      nameA: fileA.parsed.name ?? fileA.fileName,
      nameB: fileB.parsed.name ?? fileB.fileName,
      sections: OUTPUT_SECTIONS,
      sectionLabels: {
        onlyInA: sectionLabels.onlyInA,
        onlyInB: sectionLabels.onlyInB
      },
      sizeContext,
      sizeFooter
    });
  }, [
    fileA,
    fileB,
    filteredDiff,
    sectionLabels,
    formatForDiscord,
    showAsHyperlinks,
    outputEmptyMessage,
    sizeContext,
    sizeFooter
  ]);

  const discordOutput = useMemo(() => {
    if (!fileA || !fileB || !filteredDiff || !sectionLabels) {
      return null;
    }

    if (filteredDiff.onlyInA.length === 0 && filteredDiff.onlyInB.length === 0) {
      return buildEmptySnapshot(outputEmptyMessage || "No differences found.");
    }

    return formatDiffResult(filteredDiff, {
      format: "discord",
      includeLinks: showAsHyperlinks,
      nameA: fileA.parsed.name ?? fileA.fileName,
      nameB: fileB.parsed.name ?? fileB.fileName,
      sections: OUTPUT_SECTIONS,
      sectionLabels: {
        onlyInA: sectionLabels.onlyInA,
        onlyInB: sectionLabels.onlyInB
      },
      sizeContext,
      sizeFooter
    });
  }, [fileA, fileB, filteredDiff, sectionLabels, showAsHyperlinks, outputEmptyMessage, sizeContext, sizeFooter]);

  const handleFileChange =
    (slot: "A" | "B") => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      loadFileIntoSlot(slot, file);
    };

  const handleDrop =
    (slot: "A" | "B") => (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragOverSlot(null);
      const file = event.dataTransfer.files?.[0];
      if (!file) {
        return;
      }
      loadFileIntoSlot(slot, file);
    };

  const handleDragOver =
    (slot: "A" | "B") => (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragOverSlot(slot);
    };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverSlot(null);
  };

  const toggleIncluded = (section: DiffSectionKey, mod: ArmaModEntry) => {
    const key = modKey(section, mod);
    setIncludedByKey((previous) => ({
      ...previous,
      [key]: !(previous[key] ?? true)
    }));
  };

  const toggleMerge = (section: DiffSectionKey, mod: ArmaModEntry) => {
    if (section === "common") {
      return;
    }
    const key = modKey(section, mod);
    setMergeByKey((previous) => ({
      ...previous,
      [key]: !(previous[key] ?? true)
    }));
  };

  const setSectionIncluded = (section: DiffSectionKey, value: boolean) => {
    if (!rawDiff) {
      return;
    }

    setIncludedByKey((previous) => {
      const next = { ...previous };
      for (const mod of rawDiff[section]) {
        next[modKey(section, mod)] = value;
      }
      return next;
    });
  };

  const setSectionMerged = (section: DiffSectionKey, value: boolean) => {
    if (!rawDiff || section === "common") {
      return;
    }

    setMergeByKey((previous) => {
      const next = { ...previous };
      for (const mod of rawDiff[section]) {
        next[modKey(section, mod)] = value;
      }
      return next;
    });
  };

  const mergeCandidates = useMemo(() => {
    if (!rawDiff) {
      return [] as ArmaModEntry[];
    }

    const commonIncluded = rawDiff.common.filter(
      (mod) => includedByKey[modKey("common", mod)] !== false
    );
    const onlyAIncluded = rawDiff.onlyInA.filter((mod) => {
      const key = modKey("onlyInA", mod);
      return includedByKey[key] !== false && mergeByKey[key] !== false;
    });
    const onlyBIncluded = rawDiff.onlyInB.filter((mod) => {
      const key = modKey("onlyInB", mod);
      return includedByKey[key] !== false && mergeByKey[key] !== false;
    });

    return [...commonIncluded, ...onlyAIncluded, ...onlyBIncluded];
  }, [rawDiff, includedByKey, mergeByKey]);

  const activeMergeSelections = useMemo(() => {
    if (!rawDiff) {
      return 0;
    }

    let count = 0;
    for (const section of ["onlyInA", "onlyInB"] as const) {
      for (const mod of rawDiff[section]) {
        const key = modKey(section, mod);
        if (includedByKey[key] !== false && mergeByKey[key] !== false) {
          count += 1;
        }
      }
    }
    return count;
  }, [rawDiff, includedByKey, mergeByKey]);

  const handleMergeDownload = () => {
    if (mergeCandidates.length === 0 || activeMergeSelections === 0) {
      return;
    }

    const effectiveName = mergeName.trim() || "Merged Preset";
    const html = mergeModLists(mergeCandidates, {
      name: effectiveName,
      type: mergeType
    });
    const safeName = effectiveName.replace(/[<>:"/\\|?*]/g, "_");
    const fileName = `${safeName}.html`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setMergeStatus(`Merged ${mergeCandidates.length} mods into ${fileName}.`);
  };

  const handleSwapFiles = () => {
    setMergeStatus(null);
    setCopyStatus(null);
    setError(null);
    setFileA(fileB);
    setFileB(fileA);
    setCurrentSlot((previous) => {
      if (previous === "A") {
        return "B";
      }
      if (previous === "B") {
        return "A";
      }
      return null;
    });
  };

  const handleReset = () => {
    setFileA(null);
    setFileB(null);
    setCurrentSlot(null);
    setError(null);
    setCopyStatus(null);
    setMergeStatus(null);
    setIncludedByKey({});
    setMergeByKey({});
    setMergeName("Merged Preset");
    setMergeType("preset");
    setShowAsHyperlinks(false);
    setFormatForDiscord(false);
    setDragOverSlot(null);
    setIncludeSizes(false);
    setSortOption("default");
  };

  const handleCopyOutput = async () => {
    if (!formattedOutput) {
      return;
    }
    try {
      await copyWithFallback(formattedOutput.text);
      setCopyStatus("Copied current output to clipboard.");
    } catch {
      setCopyStatus("Clipboard copy failed.");
    }
  };

  const handleCopyDiscord = async () => {
    if (!discordOutput) {
      return;
    }

    if (discordOutput.parts.length <= 1) {
      try {
        await copyWithFallback(discordOutput.parts[0] ?? discordOutput.text);
        setCopyStatus("Copied! Paste into Discord.");
      } catch {
        setCopyStatus("Clipboard copy failed.");
      }
    } else {
      try {
        await copyWithFallback(discordOutput.parts[0]);
        setCopyStatus(`Copied part 1 of ${discordOutput.parts.length}. Use the part buttons below to copy the rest.`);
      } catch {
        setCopyStatus("Clipboard copy failed.");
      }
    }
  };

  const handleCopyDiscordPart = async (partIndex: number) => {
    if (!discordOutput) {
      return;
    }
    try {
      await copyWithFallback(discordOutput.parts[partIndex]);
      setCopyStatus(`Copied part ${partIndex + 1} of ${discordOutput.parts.length}.`);
    } catch {
      setCopyStatus("Clipboard copy failed.");
    }
  };

  const getCount = (section: DiffSectionKey): number => rawDiff?.[section].length ?? 0;

  return (
    <main className="page">
      <header>
        <h1>Arma Modlist Diff & Merge</h1>
        <p>Upload two Arma preset/modlist HTML files to compare and format the differences, or upload one to view and edit.</p>
      </header>

      <section className="upload-grid">
        <div
          className={dragOverSlot === "A" ? "card drop-zone drag-over" : "card drop-zone"}
          onDrop={handleDrop("A")}
          onDragOver={handleDragOver("A")}
          onDragLeave={handleDragLeave}
        >
          <span className="card-title">File A</span>
          <input
            type="file"
            accept=".html,text/html"
            onChange={handleFileChange("A")}
            disabled={isParsingA}
            aria-label="Upload File A Arma preset or modlist"
          />
          {isParsingA ? <p className="meta">Parsing file...</p> : null}
          {fileA ? (
            <>
              <p className="meta">
                {fileA.parsed.name ?? fileA.fileName} | {fileA.parsed.type} | {fileA.parsed.mods.length} mods
              </p>
              <label className="current-label">
                <input
                  type="radio"
                  name="currentSlot"
                  checked={currentSlot === "A"}
                  onChange={() => setCurrentSlot("A")}
                  onClick={() => {
                    if (currentSlot === "A") {
                      setCurrentSlot(null);
                    }
                  }}
                />
                Current modlist
              </label>
            </>
          ) : null}
        </div>

        <div
          className={dragOverSlot === "B" ? "card drop-zone drag-over" : "card drop-zone"}
          onDrop={handleDrop("B")}
          onDragOver={handleDragOver("B")}
          onDragLeave={handleDragLeave}
        >
          <span className="card-title">File B</span>
          <input
            type="file"
            accept=".html,text/html"
            onChange={handleFileChange("B")}
            disabled={isParsingB}
            aria-label="Upload File B Arma preset or modlist"
          />
          {isParsingB ? <p className="meta">Parsing file...</p> : null}
          {fileB ? (
            <>
              <p className="meta">
                {fileB.parsed.name ?? fileB.fileName} | {fileB.parsed.type} | {fileB.parsed.mods.length} mods
              </p>
              <label className="current-label">
                <input
                  type="radio"
                  name="currentSlot"
                  checked={currentSlot === "B"}
                  onChange={() => setCurrentSlot("B")}
                  onClick={() => {
                    if (currentSlot === "B") {
                      setCurrentSlot(null);
                    }
                  }}
                />
                Current modlist
              </label>
            </>
          ) : null}
        </div>
      </section>

      <section className="toolbar">
        <button type="button" className="secondary" onClick={handleSwapFiles} disabled={!fileA && !fileB}>
          Swap Files
        </button>
        <button
          type="button"
          className="secondary"
          onClick={handleReset}
          disabled={!fileA && !fileB && !error && !copyStatus && !mergeStatus}
        >
          Reset
        </button>
      </section>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {copyStatus ? (
        <p className="meta" role="status" aria-live="polite">
          {copyStatus}
        </p>
      ) : null}
      {!error && fileA && fileB && !rawHasDifferences && fileA.fileName === fileB.fileName ? (
        <p className="meta">Both uploaded files appear to be identical.</p>
      ) : null}

      {fileA || fileB ? (
        <div className="size-toggle">
          <label className="current-label">
            <input
              type="checkbox"
              checked={includeSizes}
              onChange={(event) => setIncludeSizes(event.target.checked)}
            />
            Include mod sizes
          </label>
          <span className="size-warning">Fetches data from the Steam Web API via proxy</span>
          {modSizes.loading ? <span className="meta">Loading sizes...</span> : null}
          {modSizes.error ? <span className="warning">{modSizes.error}</span> : null}
          <label className="sort-label">
            Sort:
            <select
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value as SortOption)}
            >
              <option value="default">Default</option>
              <option value="a-z">Name (A-Z)</option>
              <option value="z-a">Name (Z-A)</option>
              {includeSizes && !modSizes.loading && Object.keys(modSizes.sizes).length > 0 ? (
                <>
                  <option value="size-desc">Size (largest)</option>
                  <option value="size-asc">Size (smallest)</option>
                </>
              ) : null}
            </select>
          </label>
        </div>
      ) : null}

      {!rawDiff && (fileA || fileB) ? (() => {
        const singleFile = fileA ?? fileB;
        if (!singleFile) return null;
        const mods = sortMods(singleFile.parsed.mods, sortOption, sizeContext?.sizes);
        return (
          <section className="section-grid" style={{ gridTemplateColumns: "1fr" }}>
            <article className="card section-card" role="region" aria-labelledby="section-title-single">
              <div className="section-header">
                <h2 id="section-title-single">
                  {singleFile.parsed.name ?? singleFile.fileName} ({mods.length})
                  {sizeContext ? (
                    <span className="section-size">
                      {" "}[{formatBytes(sumSectionSize(mods, sizeContext.sizes))}]
                    </span>
                  ) : null}
                </h2>
              </div>
              <ul className="mod-list-ui">
                {mods.map((mod) => (
                  <li key={mod.steamId ?? mod.displayName} className="mod-item">
                    <div className="mod-main">
                      <span>{mod.displayName}</span>
                      {sizeContext && mod.steamId && mod.steamId in sizeContext.sizes ? (
                        <span className="mod-size">[{formatBytes(sizeContext.sizes[mod.steamId])}]</span>
                      ) : null}
                    </div>
                    <div className="mod-actions">
                      {mod.steamUrl ? (
                        <a href={mod.steamUrl} target="_blank" rel="noreferrer">Steam</a>
                      ) : (
                        <span className="mod-source-local">Local</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {sizeContext ? (
                <p className="modlist-total">
                  [{formatBytes(sumSectionSize(mods, sizeContext.sizes))}]
                </p>
              ) : null}
            </article>
          </section>
        );
      })() : null}

      {rawDiff && sectionLabels ? (
        <section className="section-grid">
          {ALL_SECTIONS.map((section) => (
            <article
              key={section}
              className="card section-card"
              role="region"
              aria-labelledby={`section-title-${section}`}
            >
              <div className="section-header">
                <h2 id={`section-title-${section}`}>
                  {sectionLabels[section]} ({getCount(section)})
                  {sizeContext ? (
                    <span className="section-size">
                      {" "}[{formatBytes(sumSectionSize(rawDiff[section], sizeContext.sizes))}]
                    </span>
                  ) : null}
                </h2>
                <div className="section-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setSectionIncluded(section, true)}
                    aria-label={`Include all mods in ${sectionLabels[section]}`}
                  >
                    Include All
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setSectionIncluded(section, false)}
                    aria-label={`Exclude all mods in ${sectionLabels[section]}`}
                  >
                    Exclude All
                  </button>
                  {section !== "common" ? (
                    <>
                      <button
                        type="button"
                        className="secondary merge"
                        onClick={() => setSectionMerged(section, true)}
                        aria-label={`Enable merge for all mods in ${sectionLabels[section]}`}
                        data-testid={`merge-all-${section}`}
                      >
                        Merge All
                      </button>
                      <button
                        type="button"
                        className="secondary merge"
                        onClick={() => setSectionMerged(section, false)}
                        aria-label={`Disable merge for all mods in ${sectionLabels[section]}`}
                        data-testid={`merge-none-${section}`}
                      >
                        Merge None
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <ul className="mod-list-ui">
                {rawDiff[section].length === 0 ? (
                  <li className="mod-empty">No mods in this section.</li>
                ) : (
                  sortMods(rawDiff[section], sortOption, sizeContext?.sizes).map((mod) => {
                    const key = modKey(section, mod);
                    const checked = includedByKey[key] !== false;
                    return (
                      <li key={key} className={checked ? "mod-item" : "mod-item mod-item-excluded"}>
                        <div className="mod-main">
                          <label>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleIncluded(section, mod)}
                              aria-label={`Include ${mod.displayName} in ${sectionLabels[section]} output`}
                            />
                            <span>{mod.displayName}</span>
                          </label>
                          {sizeContext && mod.steamId && mod.steamId in sizeContext.sizes ? (
                            <span className="mod-size">[{formatBytes(sizeContext.sizes[mod.steamId])}]</span>
                          ) : null}
                        </div>
                        <div className="mod-actions">
                          {section !== "common" ? (
                            <label className="merge-toggle">
                              <input
                                type="checkbox"
                                checked={mergeByKey[key] !== false}
                                disabled={!checked}
                                onChange={() => toggleMerge(section, mod)}
                                aria-label={`Include ${mod.displayName} in merged output`}
                              />
                              <span>Merge</span>
                            </label>
                          ) : (
                            <span className="merge-common">Always merge</span>
                          )}
                          {mod.steamUrl ? (
                            <a href={mod.steamUrl} target="_blank" rel="noreferrer">
                              Steam
                            </a>
                          ) : (
                            <span className="mod-source-local">Local</span>
                          )}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              {sizeContext && section !== "common" ? (
                <p className="modlist-total">
                  [{formatBytes(section === "onlyInA" ? modSizes.totalA : modSizes.totalB)}]
                </p>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      <section className="card merge-card">
        <div className="results-header">
          <h2>Merge and Export</h2>
          <button
            type="button"
            className="merge-primary"
            onClick={handleMergeDownload}
            disabled={mergeCandidates.length === 0 || activeMergeSelections === 0}
            aria-label="Merge selected mods and download HTML preset"
          >
            Merge Selected
          </button>
        </div>
        <div className="merge-options">
          <label>
            Merged Name
            <input
              type="text"
              value={mergeName}
              onChange={(event) => setMergeName(event.target.value)}
              placeholder="Merged Preset"
            />
          </label>
          <fieldset>
            <legend>Output Type</legend>
            <label className="current-label">
              <input
                type="radio"
                name="mergeType"
                checked={mergeType === "preset"}
                onChange={() => setMergeType("preset")}
              />
              Export as Preset
            </label>
            <label className="current-label">
              <input
                type="radio"
                name="mergeType"
                checked={mergeType === "list"}
                onChange={() => setMergeType("list")}
              />
              Export as Modlist
            </label>
          </fieldset>
        </div>
        <p className="meta">Current merge set: {mergeCandidates.length} mods.</p>
        {rawDiff && activeMergeSelections === 0 ? (
          <p className="warning">All merge checkboxes are unchecked. Select at least one mod to merge.</p>
        ) : null}
        {mergeStatus ? (
          <p className="meta" role="status" aria-live="polite">
            {mergeStatus}
          </p>
        ) : null}
      </section>

      <section className="card results">
        <div className="results-header">
          <h2>Formatted Output</h2>
          <div className="results-actions">
            <button
              type="button"
              onClick={() => {
                void handleCopyOutput();
              }}
              disabled={!formattedOutput}
            >
              Copy to Clipboard
            </button>
            <button
              type="button"
              onClick={() => {
                void handleCopyDiscord();
              }}
              disabled={!discordOutput}
            >
              Copy for Discord
            </button>
          </div>
        </div>

        <div className="format-options">
          <label className="current-label">
            <input
              type="checkbox"
              checked={showAsHyperlinks}
              onChange={(event) => setShowAsHyperlinks(event.target.checked)}
            />
            Show as hyperlinks
          </label>
          <label className="current-label">
            <input
              type="checkbox"
              checked={formatForDiscord}
              onChange={(event) => setFormatForDiscord(event.target.checked)}
            />
            Format for Discord
          </label>
        </div>

        <textarea
          readOnly
          value={formattedOutput?.text ?? outputEmptyMessage}
          rows={16}
          aria-label="Formatted diff output"
        />

        {discordOutput && discordOutput.parts.length > 1 ? (
          <div className="discord-parts">
            <p className="warning">
              Discord output is split into {discordOutput.parts.length} parts due to the 2000-character limit.
            </p>
            <div className="discord-parts-buttons">
              {discordOutput.parts.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className="secondary"
                  onClick={() => {
                    void handleCopyDiscordPart(index);
                  }}
                >
                  Copy Part {index + 1}
                </button>
              ))}
            </div>
          </div>
        ) : null}

      </section>
    </main>
  );
}
