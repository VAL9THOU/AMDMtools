interface Env {
  STEAM_API_KEY: string;
  ALLOWED_ORIGIN: string;
  MOD_SIZES_KV: KVNamespace;
}

const KV_TTL_SECONDS = 7 * 24 * 60 * 60;

const STEAM_API_URL =
  "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/";

const MAX_IDS_PER_REQUEST = 100;

interface SteamFileDetails {
  publishedfileid: string;
  file_size?: number | string;
  result: number;
}

interface SteamApiResponse {
  response: {
    result: number;
    resultcount: number;
    publishedfiledetails: SteamFileDetails[];
  };
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function jsonResponse(data: unknown, status: number, env: Env): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(env)
    }
  });
}

function jsonError(message: string, status: number, env: Env): Response {
  return jsonResponse({ error: message }, status, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (request.method !== "POST") {
      return jsonError("Method not allowed", 405, env);
    }

    let steamIds: string[];
    try {
      const body = (await request.json()) as { steamIds: unknown };
      if (!Array.isArray(body.steamIds) || body.steamIds.length === 0) {
        return jsonError("steamIds must be a non-empty array", 400, env);
      }
      steamIds = body.steamIds
        .filter((id: unknown): id is string => typeof id === "string" && /^\d+$/.test(id))
        .slice(0, MAX_IDS_PER_REQUEST);
      if (steamIds.length === 0) {
        return jsonError("No valid steam IDs provided", 400, env);
      }
    } catch {
      return jsonError("Invalid JSON body", 400, env);
    }

    const sizes: Record<string, number | null> = {};
    const uncachedIds: string[] = [];

    for (const id of steamIds) {
      const cached = await env.MOD_SIZES_KV.get(`size:${id}`);
      if (cached !== null) {
        sizes[id] = cached === "null" ? null : Number(cached);
      } else {
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length > 0) {
      try {
        const formData = new URLSearchParams();
        formData.append("itemcount", String(uncachedIds.length));
        uncachedIds.forEach((id, index) => {
          formData.append(`publishedfileids[${index}]`, id);
        });

        const steamResponse = await fetch(
          `${STEAM_API_URL}?key=${env.STEAM_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString()
          }
        );

        if (!steamResponse.ok) {
          return jsonResponse({ sizes, partial: true, error: "Steam API error" }, 207, env);
        }

        const data = (await steamResponse.json()) as SteamApiResponse;
        for (const detail of data.response.publishedfiledetails) {
          const fileSize =
            detail.result === 1 && detail.file_size != null ? Number(detail.file_size) : null;
          sizes[detail.publishedfileid] = fileSize;

          await env.MOD_SIZES_KV.put(
            `size:${detail.publishedfileid}`,
            fileSize === null ? "null" : String(fileSize),
            { expirationTtl: KV_TTL_SECONDS }
          );
        }

        for (const id of uncachedIds) {
          if (!(id in sizes)) {
            sizes[id] = null;
            await env.MOD_SIZES_KV.put(`size:${id}`, "null", {
              expirationTtl: KV_TTL_SECONDS
            });
          }
        }
      } catch {
        return jsonResponse({ sizes, partial: true, error: "Steam API unreachable" }, 207, env);
      }
    }

    return jsonResponse({ sizes, partial: false }, 200, env);
  }
};
