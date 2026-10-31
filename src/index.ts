import { toEvent } from "./events";
import { serialize } from "./ics";
import { fetchDatabase, fetchPages } from "./notion";

interface Env {
  NOTION_TOKEN: string;
  FEEDS: string; // JSON: { "<feed token>": "<notion database id>" }
}

const noStore = (status: number, body: string) =>
  new Response(body, { status, headers: { "cache-control": "no-store" } });

async function etag(body: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return `"${[...new Uint8Array(h).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("")}"`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", { status: 405, headers: { allow: "GET, HEAD", "cache-control": "no-store" } });
    }

    const m = new URL(request.url).pathname.match(/^\/feed\/([A-Za-z0-9_-]+)\.ics$/);
    const feeds: Record<string, string> = JSON.parse(env.FEEDS);
    const databaseId = m && Object.hasOwn(feeds, m[1]) ? feeds[m[1]] : undefined;
    if (!databaseId) return noStore(404, "not found");

    let body: string;
    try {
      const { name, dataSourceId } = await fetchDatabase(env.NOTION_TOKEN, databaseId);
      const pages = await fetchPages(env.NOTION_TOKEN, dataSourceId);
      body = serialize(name, pages.flatMap((p) => toEvent(p) ?? []));
    } catch (e) {
      console.error(e);
      return noStore(502, "upstream error");
    }

    const tag = await etag(body);
    const headers = {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "public, max-age=300",
      etag: tag,
    };
    if (request.headers.get("if-none-match") === tag) return new Response(null, { status: 304, headers });
    return new Response(request.method === "HEAD" ? null : body, { headers });
  },
};
