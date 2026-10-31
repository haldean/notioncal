export interface CalEvent {
  uid: string;
  summary: string;
  // all-day: UTC midnight dates, end exclusive
  allDay: boolean;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  url?: string;
  created: Date;
  modified: Date;
}

const enc = new TextEncoder();

export const escapeText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");

// fold at 75 octets without splitting a UTF-8 sequence; continuation lines start with a space
export function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const fmtDate = (d: Date) => `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const fmtDateTime = (d: Date) =>
  `${fmtDate(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export function serialize(name: string, events: CalEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//notioncal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${fmtDateTime(e.modified)}`);
    lines.push(`CREATED:${fmtDateTime(e.created)}`, `LAST-MODIFIED:${fmtDateTime(e.modified)}`);
    if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${fmtDate(e.start)}`, `DTEND;VALUE=DATE:${fmtDate(e.end)}`);
    else lines.push(`DTSTART:${fmtDateTime(e.start)}`, `DTEND:${fmtDateTime(e.end)}`);
    lines.push(`SUMMARY:${escapeText(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
