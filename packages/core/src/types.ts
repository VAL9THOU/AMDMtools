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

export interface FormatOptions {
  format: OutputFormat;
  includeLinks: boolean;
  rawString?: boolean;
  nameA?: string;
  nameB?: string;
  sections?: DiffSectionKey[];
  sectionLabels?: Partial<Record<DiffSectionKey, string>>;
  discordLimit?: number;
}

export interface FormatResult {
  text: string;
  parts: string[];
  characterCount: number;
}
