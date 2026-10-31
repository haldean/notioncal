# notioncal

Publishes a Notion database as a read-only iCalendar (`.ics`) feed that Apple Calendar, Google Calendar and Outlook can subscribe to. It runs on one Cloudflare Worker.

## How it works
- `GET /feed/<token>.ics` looks `<token>` up in the `FEEDS` secret to find a Notion database, reads its rows through the Notion API (`2026-03-11`, via the database's first data source), and returns them as a calendar.
- The Notion token stays in the Worker. Calendar clients only hold the feed URL, so treat the token in it as a password.
- Responses carry `Cache-Control: public, max-age=300` and Cloudflare's [Workers Cache](https://developers.cloudflare.com/workers/cache/) (`[cache] enabled = true` in `wrangler.toml`) serves repeat requests without running the Worker. Edits in Notion can take up to 5 minutes to appear, and each Cloudflare region caches separately. Unknown tokens and errors are `no-store`.
- Only `GET`/`HEAD` are handled and no write calls to Notion exist.

## Database convention
Property names are case-sensitive.

| Property | Type | Becomes |
|---|---|---|
| `Name` | title | event title (`(untitled)` if empty) |
| `Date` | date | start/end. Rows with no date are skipped |
| `Description` | text | description (optional) |
| `Location` | text | location (optional) |

- A date without a time is an all-day event. A range's end date is inclusive in Notion, and the feed accounts for that.
- A date with a time but no end is **1 hour** long.
- The event's `UID` is the Notion page id, so edits update the event rather than duplicating it. Each event links back to its Notion page.

## Setup (once)
1. Create an internal integration at notion.so/profile/integrations, then open the database → `•••` → Connections and add it.
2. Copy the database id (the 32-character id in its URL).
3. ```bash
   npm i
   npx wrangler login
   npx wrangler secret put NOTION_TOKEN   # the integration secret
   openssl rand -hex 24                   # generate a feed token
   npx wrangler secret put FEEDS          # {"<feed token>":"<database id>"}
   npm run deploy
   ```
   If `secret put` says the Worker doesn't exist yet, run `npm run deploy` first.
4. Subscribe to `https://notioncal.brownchao.com/feed/<feed token>.ics` (a Worker custom domain set via `routes` in `wrangler.toml`; as a side effect the `workers.dev` URL is disabled, add `workers_dev = true` to bring it back) (Apple: File → New Calendar Subscription; Google: Other calendars → From URL).

Several databases can share a Worker by adding more entries to `FEEDS`. To revoke a feed, remove its entry.

## Local dev
Copy `.dev.vars.example` to `.dev.vars`, fill it in, run `npm run dev`, then `curl -i localhost:8787/feed/<token>.ics`. Tests: `npm test`.

## Not supported
Recurring events (Notion has none), configurable property names, write-back.
