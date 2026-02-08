export type ModSource = "steam" | "local";

export interface ArmaModEntry {
  displayName: string;
  steamId: string | null;
  steamUrl: string | null;
  source: ModSource;
}

export interface ArmaModList {
  name: string | null;
  type: "preset" | "list";
  mods: ArmaModEntry[];
}

export interface ModDiffResult {
  onlyInA: ArmaModEntry[];
  onlyInB: ArmaModEntry[];
  common: ArmaModEntry[];
}

export interface DiffOptions {
  identityFn?: (mod: ArmaModEntry) => string;
}

export interface MergeOptions {
  name: string;
  type: "preset" | "list";
}

export type DiffSectionKey = "onlyInA" | "onlyInB" | "common";
export type OutputFormat = "plain" | "discord" | "html-links";

/** Maps steamId to file size in bytes. Absence means unknown/loading. */
export type ModSizeMap = Record<string, number>;

/** Size data passed to the formatter. Omitting means no sizes shown. */
export interface SizeContext {
  /** Map of steamId to byte size for resolved mods */
  sizes: ModSizeMap;
  /** Total size in bytes for the entire A modlist (all mods, not just diff section) */
  totalA?: number;
  /** Total size in bytes for the entire B modlist (all mods, not just diff section) */
  totalB?: number;
}

export interface FormatOptions {
  format: OutputFormat;
  includeLinks: boolean;
  rawString?: boolean;
  nameA?: string;
  nameB?: string;
  sections?: DiffSectionKey[];
  sectionLabels?: Partial<Record<DiffSectionKey, string>>;
  discordLimit?: number;
  /** When provided, sizes are rendered next to mod names, in section headers, and in the footer. */
  sizeContext?: SizeContext;
  /** Optional footer line appended after all sections (e.g., "12.5 GB -> 14.2 GB") */
  sizeFooter?: string;
}

export interface FormatResult {
  text: string;
  parts: string[];
  characterCount: number;
}
