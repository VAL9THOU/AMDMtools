import type { ArmaModEntry, ArmaModList, ModSource } from "../types";
import type { ModListParser } from "./interface";

const MOD_CONTAINER_PATTERN =
  /<tr[^>]*data-type\s*=\s*["']ModContainer["'][^>]*>([\s\S]*?)<\/tr>/gi;
const DISPLAY_NAME_PATTERN =
  /<td[^>]*data-type\s*=\s*["']DisplayName["'][^>]*>([\s\S]*?)<\/td>/i;
const LINK_TAG_PATTERN = /<a[^>]*data-type\s*=\s*["']Link["'][^>]*>/i;
const STEAM_ID_PATTERN = /[?&]id=(\d+)/i;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " "
  };

  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (full, token: string) => {
    if (token.startsWith("#x") || token.startsWith("#X")) {
      const code = Number.parseInt(token.slice(2), 16);
      return Number.isNaN(code) ? full : String.fromCodePoint(code);
    }

    if (token.startsWith("#")) {
      const code = Number.parseInt(token.slice(1), 10);
      return Number.isNaN(code) ? full : String.fromCodePoint(code);
    }

    return named[token.toLowerCase()] ?? full;
  });
}

function readAttribute(tag: string, attributeName: string): string | null {
  const attributePattern = new RegExp(
    `${escapeRegex(attributeName)}\\s*=\\s*["']([^"']*)["']`,
    "i"
  );
  const match = attributePattern.exec(tag);
  if (!match) {
    return null;
  }

  return decodeHtmlEntities(match[1]).trim();
}

function getMetaContent(input: string, metaName: string): string | null {
  const metaPattern = new RegExp(
    `<meta[^>]*name\\s*=\\s*["']${escapeRegex(metaName)}["'][^>]*>`,
    "i"
  );
  const tagMatch = metaPattern.exec(input);
  if (!tagMatch) {
    return null;
  }

  return readAttribute(tagMatch[0], "content");
}

function inferSource(modRowHtml: string, steamId: string | null): ModSource {
  if (/class\s*=\s*["'][^"']*\bfrom-local\b[^"']*["']/i.test(modRowHtml)) {
    return "local";
  }

  if (/class\s*=\s*["'][^"']*\bfrom-steam\b[^"']*["']/i.test(modRowHtml)) {
    return "steam";
  }

  return steamId ? "steam" : "local";
}

function parseSteamId(steamUrl: string | null): string | null {
  if (!steamUrl) {
    return null;
  }
  const match = STEAM_ID_PATTERN.exec(steamUrl);
  return match?.[1] ?? null;
}

function parseSingleMod(modRowHtml: string): ArmaModEntry | null {
  const nameMatch = DISPLAY_NAME_PATTERN.exec(modRowHtml);
  const rawName = nameMatch ? nameMatch[1] : "";
  const displayName = normalizeWhitespace(decodeHtmlEntities(stripHtml(rawName)));
  if (!displayName) {
    return null;
  }

  const linkTagMatch = LINK_TAG_PATTERN.exec(modRowHtml);
  const steamUrl = linkTagMatch ? readAttribute(linkTagMatch[0], "href") : null;
  const steamId = parseSteamId(steamUrl);
  const source = inferSource(modRowHtml, steamId);

  return {
    displayName,
    steamId,
    steamUrl,
    source
  };
}

export class ArmaHtmlParser implements ModListParser {
  parse(input: string): ArmaModList {
    if (!input.trim()) {
      throw new Error("Input HTML is empty.");
    }

    const type = getMetaContent(input, "arma:Type");
    if (type !== "preset" && type !== "list") {
      throw new Error("Input is not a supported Arma preset/modlist export (missing arma:Type).");
    }

    const presetName = getMetaContent(input, "arma:PresetName");
    const mods: ArmaModEntry[] = [];
    const modContainerPattern = new RegExp(MOD_CONTAINER_PATTERN.source, MOD_CONTAINER_PATTERN.flags);

    for (const match of input.matchAll(modContainerPattern)) {
      const mod = parseSingleMod(match[1]);
      if (mod) {
        mods.push(mod);
      }
    }

    return {
      name: presetName ?? null,
      type,
      mods
    };
  }
}
