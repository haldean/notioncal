import type { CalEvent } from "./ics";

export interface NotionPage {
  id: string;
  url?: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, any>;
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

const plain = (prop: any): string =>
  ((prop?.title ?? prop?.rich_text ?? []) as { plain_text: string }[]).map((t) => t.plain_text).join("");

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/;

function tzOffsetMs(ms: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric",
    }).formatToParts(new Date(ms)).map((p) => [p.type, Number(p.value)]),
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(ms / 1000) * 1000;
}

// Notion gives a wall-clock time plus time_zone when the user picked a zone; otherwise an explicit offset
export function parseInstant(s: string, tz?: string | null): Date {
  if (HAS_OFFSET.test(s)) return new Date(s);
  if (!tz) return new Date(s + "Z");
  const asUtc = Date.parse(s + "Z");
  const off = tzOffsetMs(asUtc, tz);
  const t = asUtc - off;
  const off2 = tzOffsetMs(t, tz);
  return new Date(off2 === off ? t : asUtc - off2);
}

export function toEvent(page: NotionPage): CalEvent | null {
  const date = page.properties.Date?.date;
  if (!date?.start) return null;

  const allDay = date.start.length === 10;
  let start: Date, end: Date;
  if (allDay) {
    start = new Date(date.start + "T00:00:00Z");
    // Notion's end date is inclusive, ICS DTEND is exclusive
    end = new Date((date.end ? Date.parse(date.end.slice(0, 10) + "T00:00:00Z") : start.getTime()) + DAY);
  } else {
    start = parseInstant(date.start, date.time_zone);
    end = date.end ? parseInstant(date.end, date.time_zone) : new Date(start.getTime() + HOUR);
  }

  return {
    uid: `${page.id}@notioncal`,
    summary: plain(page.properties.Name) || "(untitled)",
    allDay,
    start,
    end,
    description: plain(page.properties.Description) || undefined,
    location: plain(page.properties.Location) || undefined,
    url: page.url,
    created: new Date(page.created_time),
    modified: new Date(page.last_edited_time),
  };
}
