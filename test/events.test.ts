import { describe, expect, it } from "vitest";
import { parseInstant, toEvent, type NotionPage } from "../src/events";

const text = (s: string) => [{ plain_text: s }];
const page = (props: Record<string, any>): NotionPage => ({
  id: "p1",
  url: "https://www.notion.so/p1",
  created_time: "2026-10-01T00:00:00.000Z",
  last_edited_time: "2026-10-02T00:00:00.000Z",
  properties: { Name: { title: text("Lunch") }, ...props },
});
const date = (start: string, end: string | null = null, time_zone: string | null = null) => ({
  Date: { date: { start, end, time_zone } },
});

describe("toEvent", () => {
  it("skips rows without a date", () => {
    expect(toEvent(page({ Date: { date: null } }))).toBeNull();
    expect(toEvent(page({}))).toBeNull();
  });

  it("maps a single all-day event to one day", () => {
    const e = toEvent(page(date("2026-11-01")))!;
    expect(e.allDay).toBe(true);
    expect(e.start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(e.end.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("makes the all-day end exclusive", () => {
    const e = toEvent(page(date("2026-11-01", "2026-11-03")))!;
    expect(e.end.toISOString()).toBe("2026-11-04T00:00:00.000Z");
  });

  it("defaults timed events to one hour", () => {
    const e = toEvent(page(date("2026-10-31T14:00:00.000-07:00")))!;
    expect(e.allDay).toBe(false);
    expect(e.start.toISOString()).toBe("2026-10-31T21:00:00.000Z");
    expect(e.end.toISOString()).toBe("2026-10-31T22:00:00.000Z");
  });

  it("uses the given end for timed events", () => {
    const e = toEvent(page(date("2026-10-31T14:00:00.000-07:00", "2026-10-31T16:30:00.000-07:00")))!;
    expect(e.end.toISOString()).toBe("2026-10-31T23:30:00.000Z");
  });

  it("applies time_zone to offset-less times", () => {
    const e = toEvent(page(date("2026-10-31T14:00:00.000", null, "America/Los_Angeles")))!;
    expect(e.start.toISOString()).toBe("2026-10-31T21:00:00.000Z"); // PDT
    expect(parseInstant("2026-12-01T14:00:00.000", "America/Los_Angeles").toISOString()).toBe("2026-12-01T22:00:00.000Z"); // PST
  });

  it("fills optional fields and falls back for an empty title", () => {
    const e = toEvent(page({ ...date("2026-11-01"), Name: { title: [] }, Location: { rich_text: text("Cafe") }, Description: { rich_text: [] } }))!;
    expect(e.summary).toBe("(untitled)");
    expect(e.location).toBe("Cafe");
    expect(e.description).toBeUndefined();
    expect(e.uid).toBe("p1@notioncal");
    expect(e.url).toBe("https://www.notion.so/p1");
  });
});
