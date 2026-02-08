import type {
  ArmaModEntry,
  DiffSectionKey,
  FormatOptions,
  FormatResult,
  ModDiffResult,
  ModSizeMap
} from "./types";

const DEFAULT_DISCORD_LIMIT = 2000;

type NormalizedFormatOptions = Omit<FormatOptions, "sections"> & { sections: DiffSectionKey[] };

function trimDecimal(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${trimDecimal(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${trimDecimal(mb)} MB`;
  const gb = mb / 1024;
  return `${trimDecimal(gb)} GB`;
}

function sumSectionBytes(mods: ArmaModEntry[], sizes: ModSizeMap): number {
  let total = 0;
  for (const mod of mods) {
    if (mod.steamId && mod.steamId in sizes) {
      total += sizes[mod.steamId];
    }
  }
  return total;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMod(mod: ArmaModEntry, options: FormatOptions): string {
  let base: string;

  if (!options.includeLinks || !mod.steamUrl) {
    base = mod.displayName;
  } else if (options.format === "discord") {
    base = `[${mod.displayName}](${mod.steamUrl})`;
  } else if (options.format === "html-links") {
    base = `<a href="${escapeHtml(mod.steamUrl)}">${escapeHtml(mod.displayName)}</a>`;
  } else {
    base = `${mod.displayName} (${mod.steamUrl})`;
  }

  const sizeContext = options.sizeContext;
  if (sizeContext && mod.steamId && mod.steamId in sizeContext.sizes) {
    const size = formatBytes(sizeContext.sizes[mod.steamId]);
    return `${base} [${size}]`;
  }

  return base;
}

function sectionTitle(
  section: DiffSectionKey,
  diff: ModDiffResult,
  options: NormalizedFormatOptions
): string {
  const override = options.sectionLabels?.[section];
  let label: string;

  if (override) {
    const count = diff[section].length;
    label = `${override} (${count})`;
  } else if (section === "onlyInA") {
    label = `Only in ${options.nameA ?? "File A"} (${diff.onlyInA.length})`;
  } else if (section === "onlyInB") {
    label = `Only in ${options.nameB ?? "File B"} (${diff.onlyInB.length})`;
  } else {
    label = `Common Mods (${diff.common.length})`;
  }

  const sizeContext = options.sizeContext;
  if (sizeContext) {
    const sectionBytes = sumSectionBytes(diff[section], sizeContext.sizes);
    if (sectionBytes > 0) {
      label += ` [${formatBytes(sectionBytes)}]`;
    }
  }

  return label;
}

function splitDiscordParts(text: string, limit: number): string[] {
  if (text.length <= limit) {
    return [text];
  }

  const parts: string[] = [];
  let current = "";
  const lines = text.split("\n");

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }

    if (current) {
      parts.push(current);
      current = "";
    }

    if (line.length <= limit) {
      current = line;
      continue;
    }

    for (let index = 0; index < line.length; index += limit) {
      parts.push(line.slice(index, index + limit));
    }
  }

  if (current) {
    parts.push(current);
  }

  if (parts.length <= 1) {
    return parts;
  }

  return parts.map((part, index) => `Part ${index + 1}/${parts.length}\n${part}`);
}

function renderSection(
  section: DiffSectionKey,
  diff: ModDiffResult,
  options: NormalizedFormatOptions
): string {
  const title = sectionTitle(section, diff, options);
  const mods = diff[section];
  const sizeContext = options.sizeContext;

  let modlistTotal: number | undefined;
  if (sizeContext) {
    if (section === "onlyInA") modlistTotal = sizeContext.totalA;
    if (section === "onlyInB") modlistTotal = sizeContext.totalB;
  }

  if (options.format === "discord") {
    const lines = [`**${title}**`];
    lines.push(...mods.map((mod) => `- ${renderMod(mod, options)}`));
    if (modlistTotal != null) {
      lines.push(`[${formatBytes(modlistTotal)}]`);
    }
    return lines.join("\n");
  }

  if (options.format === "html-links") {
    const lines = [`<h3>${escapeHtml(title)}</h3>`, "<ul>"];
    lines.push(...mods.map((mod) => `  <li>${renderMod(mod, options)}</li>`));
    lines.push("</ul>");
    if (modlistTotal != null) {
      lines.push(`<p>[${escapeHtml(formatBytes(modlistTotal))}]</p>`);
    }
    return lines.join("\n");
  }

  const lines = [`=== ${title} ===`];
  lines.push(...mods.map((mod) => renderMod(mod, options)));
  if (modlistTotal != null) {
    lines.push(`[${formatBytes(modlistTotal)}]`);
  }
  return lines.join("\n");
}

function normalizeFormatOptions(options: FormatOptions): NormalizedFormatOptions {
  return {
    ...options,
    sections: options.sections ?? ["onlyInA", "onlyInB", "common"]
  };
}

function formatDiffResultInternal(diff: ModDiffResult, options: FormatOptions): FormatResult {
  const normalized = normalizeFormatOptions(options);
  const sectionTexts = normalized.sections.map((section) => renderSection(section, diff, normalized));

  if (options.sizeFooter) {
    sectionTexts.push(options.sizeFooter);
  }

  const text = sectionTexts.join("\n\n").trim();
  const characterCount = text.length;

  const parts =
    normalized.format === "discord"
      ? splitDiscordParts(text, normalized.discordLimit ?? DEFAULT_DISCORD_LIMIT)
      : [text];

  return {
    text,
    parts,
    characterCount
  };
}

export function formatDiffResult(
  diff: ModDiffResult,
  options: FormatOptions & { rawString: true }
): string;
export function formatDiffResult(diff: ModDiffResult, options: FormatOptions): FormatResult;
export function formatDiffResult(
  diff: ModDiffResult,
  options: FormatOptions
): FormatResult | string {
  const formatted = formatDiffResultInternal(diff, options);
  if (options.rawString) {
    return formatted.text;
  }
  return formatted;
}
