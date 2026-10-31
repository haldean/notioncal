import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

const env = { NOTION_TOKEN: "t", FEEDS: JSON.stringify({ good: "db1" }) };
const get = (path: string, init?: RequestInit) => worker.fetch(new Request("https://x.test" + path, init), env);

function stubNotion() {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/databases/db1"))
      return Response.json({ title: [{ plain_text: "Trips" }], data_sources: [{ id: "ds1" }] });
    return Response.json({
      object: "list",
      has_more: false,
      next_cursor: null,
      results: [{
        object: "page", id: "p1", created_time: "2026-10-01T00:00:00Z", last_edited_time: "2026-10-02T00:00:00Z",
        properties: { Name: { title: [{ plain_text: "Paris" }] }, Date: { date: { start: "2026-11-01", end: null } } },
      }],
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("worker", () => {
  it("serves the feed with cache headers", async () => {
    stubNotion();
    const res = await get("/feed/good.ics");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    const body = await res.text();
    expect(body).toContain("X-WR-CALNAME:Trips");
    expect(body).toContain("SUMMARY:Paris");
  });

  it("returns 304 for a matching etag", async () => {
    stubNotion();
    const tag = (await get("/feed/good.ics")).headers.get("etag")!;
    expect((await get("/feed/good.ics", { headers: { "if-none-match": tag } })).status).toBe(304);
  });

  it("404s unknown tokens without hitting Notion or caching", async () => {
    const f = stubNotion();
    const res = await get("/feed/bad.ics");
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(f).not.toHaveBeenCalled();
    expect((await get("/feed/__proto__.ics")).status).toBe(404);
  });

  it("rejects writes and hides upstream failures", async () => {
    expect((await get("/feed/good.ics", { method: "POST" })).status).toBe(405);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    const res = await get("/feed/good.ics");
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
