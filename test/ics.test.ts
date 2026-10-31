import { describe, expect, it } from "vitest";
import { escapeText, fold, serialize, type CalEvent } from "../src/ics";

const base: CalEvent = {
  uid: "abc@notioncal",
  summary: "Hi",
  allDay: false,
  start: new Date("2026-10-31T21:00:00Z"),
  end: new Date("2026-10-31T22:00:00Z"),
  created: new Date("2026-10-01T00:00:00Z"),
  modified: new Date("2026-10-02T03:04:05Z"),
};

describe("ics", () => {
  it("escapes special characters", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("folds at 75 octets without splitting multibyte characters", () => {
    const folded = fold("X:" + "é".repeat(100));
    for (const l of folded.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe("X:" + "é".repeat(100));
  });

  it("serializes timed and all-day events with CRLF endings", () => {
    const out = serialize("Cal, one", [
      base,
      { ...base, uid: "d@notioncal", allDay: true, start: new Date("2026-11-01T00:00:00Z"), end: new Date("2026-11-03T00:00:00Z") },
    ]);
    expect(out.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(out.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(out).not.toMatch(/[^\r]\n/);
    expect(out).toContain("X-WR-CALNAME:Cal\\, one\r\n");
    expect(out).toContain("DTSTART:20261031T210000Z\r\nDTEND:20261031T220000Z\r\n");
    expect(out).toContain("DTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261103\r\n");
    expect(out).toContain("DTSTAMP:20261002T030405Z\r\n");
  });

  it("omits optional fields when absent", () => {
    const out = serialize("c", [base]);
    expect(out).not.toMatch(/DESCRIPTION|LOCATION|URL:/);
  });
});
