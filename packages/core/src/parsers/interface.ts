import type { ArmaModList } from "../types";

export interface ModListParser {
  parse(input: string): ArmaModList;
}
