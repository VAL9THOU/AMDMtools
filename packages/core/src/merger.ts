import { defaultIdentityFn } from "./differ";
import type { ArmaModEntry, MergeOptions } from "./types";

const ARMA_STYLE_BLOCK = `body {
\tmargin: 0;
\tpadding: 0;
\tcolor: #fff;
\tbackground: #000;\t
}

body, th, td {
\tfont: 95%/1.3 Roboto, Segoe UI, Tahoma, Arial, Helvetica, sans-serif;
}

td {
    padding: 3px 30px 3px 0;
}

h1 {
    padding: 20px 20px 0 20px;
    color: white;
    font-weight: 200;
    font-family: segoe ui;
    font-size: 3em;
    margin: 0;
}

em {
    font-variant: italic;
    color:silver;
}

.before-list {
    padding: 5px 20px 10px 20px;
}

.mod-list {
    background: #222222;
    padding: 20px;
}

.dlc-list {
    background: #222222;
    padding: 20px;
}

.footer {
    padding: 20px;
    color:gray;
}

.whups {
    color:gray;
}

a {
    color: #D18F21;
    text-decoration: underline;
}

a:hover {
    color:#F1AF41;
    text-decoration: none;
}

.from-steam {
    color: #449EBD;
}
.from-local {
    color: gray;
}`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inferSteamUrl(mod: ArmaModEntry): string | null {
  if (mod.steamUrl) {
    return mod.steamUrl;
  }

  if (mod.steamId) {
    return `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.steamId}`;
  }

  return null;
}

function inferSource(mod: ArmaModEntry): "steam" | "local" {
  if (mod.source === "steam" || mod.source === "local") {
    return mod.source;
  }

  return mod.steamId ? "steam" : "local";
}

function dedupeMods(mods: ArmaModEntry[]): ArmaModEntry[] {
  const byIdentity = new Map<string, ArmaModEntry>();
  for (const mod of mods) {
    const identity = defaultIdentityFn(mod);
    if (!byIdentity.has(identity)) {
      byIdentity.set(identity, mod);
    }
  }
  return [...byIdentity.values()];
}

function renderModRow(mod: ArmaModEntry): string {
  const source = inferSource(mod);
  const sourceLabel = source === "steam" ? "Steam" : "Local";
  const url = inferSteamUrl(mod);

  if (url) {
    return `        <tr data-type="ModContainer">
          <td data-type="DisplayName">${escapeHtml(mod.displayName)}</td>
          <td>
            <span class="from-${source}">${sourceLabel}</span>
          </td>
          <td>
            <a href="${escapeHtml(url)}" data-type="Link">${escapeHtml(url)}</a>
          </td>
        </tr>`;
  }

  return `        <tr data-type="ModContainer">
          <td data-type="DisplayName">${escapeHtml(mod.displayName)}</td>
          <td>
            <span class="from-${source}">${sourceLabel}</span>
          </td>
          <td></td>
        </tr>`;
}

function renderHeading(options: MergeOptions): string {
  if (options.type === "preset") {
    return `    <h1>Arma 3  - Preset <strong>${escapeHtml(options.name)}</strong></h1>`;
  }

  return "    <h1>Arma 3 Mods</h1>";
}

function renderPresetMeta(options: MergeOptions): string {
  if (options.type !== "preset") {
    return "";
  }

  return `    <meta name="arma:PresetName" content="${escapeHtml(options.name)}" />\n`;
}

export function mergeModLists(mods: ArmaModEntry[], options: MergeOptions): string {
  if (!options.name.trim()) {
    throw new Error("Merge option 'name' must be a non-empty string.");
  }

  if (options.type !== "preset" && options.type !== "list") {
    throw new Error("Merge option 'type' must be 'preset' or 'list'.");
  }

  const dedupedMods = dedupeMods(mods);
  const modRows = dedupedMods.map(renderModRow).join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<html>
  <!--Created by Arma Modlist Diff Tool-->
  <head>
    <meta name="arma:Type" content="${options.type}" />
${renderPresetMeta(options)}    <meta name="generator" content="Arma Modlist Diff Tool" />
    <title>Arma 3</title>
    <link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet" type="text/css" />
    <style>
${ARMA_STYLE_BLOCK}

</style>
  </head>
  <body>
${renderHeading(options)}
    <p class="before-list">
      <em>To import this preset, drag this file onto the Launcher window. Or click the MODS tab, then PRESET in the top right, then IMPORT at the bottom, and finally select this file.</em>
    </p>
    <div class="mod-list">
      <table>
${modRows}
      </table>
    </div>
  </body>
</html>`;
}
