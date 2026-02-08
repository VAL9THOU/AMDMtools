import { ArmaHtmlParser } from "./parsers/arma-html";
import type { ModListParser } from "./parsers/interface";
import type { ArmaModList } from "./types";

export function parseModList(input: string, parser: ModListParser = new ArmaHtmlParser()): ArmaModList {
  return parser.parse(input);
}
