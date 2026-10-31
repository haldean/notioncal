import type { NotionPage } from "./events";

const API = "https://api.notion.com/v1";
const VERSION = "2026-03-11";

export class UpstreamError extends Error {}

async function call(token: string, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "notion-version": VERSION,
      "content-type": "application/json",
    },
  });
  if (!res.ok) throw new UpstreamError(`notion ${path} -> ${res.status}`);
  return res.json();
}

// the first data source of the database is the calendar
export async function fetchDatabase(token: string, databaseId: string) {
  const db = await call(token, `/databases/${encodeURIComponent(databaseId)}`);
  const name: string = (db.title ?? []).map((t: any) => t.plain_text).join("") || "Notion calendar";
  const dataSourceId: string | undefined = db.data_sources?.[0]?.id;
  if (!dataSourceId) throw new UpstreamError("database has no data sources");
  return { name, dataSourceId };
}

export async function fetchPages(token: string, dataSourceId: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const r = await call(token, `/data_sources/${encodeURIComponent(dataSourceId)}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    pages.push(...r.results.filter((p: any) => p.object === "page"));
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return pages;
}
