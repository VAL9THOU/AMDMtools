import type {
  ArmaModEntry,
  DiffSectionKey,
  FormatOptions,
  FormatResult,
  ModDiffResult
} from "./types";

const DEFAULT_DISCORD_LIMIT = 2000;

type NormalizedFormatOptions = Omit<FormatOptions, "sections"> & { sections: DiffSectionKey[] };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMod(mod: ArmaModEntry, options: FormatOptions): string {
  if (!options.includeLinks || !mod.steamUrl) {
    return mod.displayName;
  }

  if (options.format === "discord") {
    return `[${mod.displayName}](${mod.steamUrl})`;
  }

  if (options.format === "html-links") {
    return `<a href="${escapeHtml(mod.steamUrl)}">${escapeHtml(mod.displayName)}</a>`;
  }

  return `${mod.displayName} (${mod.steamUrl})`;
}

function sectionTitle(
  section: DiffSectionKey,
  diff: ModDiffResult,
  options: NormalizedFormatOptions
): string {
  const override = options.sectionLabels?.[section];
  if (override) {
    const count = diff[section].length;
    return `${override} (${count})`;
  }

  if (section === "onlyInA") {
    return `Only in ${options.nameA ?? "File A"} (${diff.onlyInA.length})`;
  }

  if (section === "onlyInB") {
    return `Only in ${options.nameB ?? "File B"} (${diff.onlyInB.length})`;
  }

  return `Common Mods (${diff.common.length})`;
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

  if (options.format === "discord") {
    const lines = [`**${title}**`];
    lines.push(...mods.map((mod) => `- ${renderMod(mod, options)}`));
    return lines.join("\n");
  }

  if (options.format === "html-links") {
    const lines = [`<h3>${escapeHtml(title)}</h3>`, "<ul>"];
    lines.push(...mods.map((mod) => `  <li>${renderMod(mod, options)}</li>`));
    lines.push("</ul>");
    return lines.join("\n");
  }

  const lines = [`=== ${title} ===`];
  lines.push(...mods.map((mod) => renderMod(mod, options)));
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
