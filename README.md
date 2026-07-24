# Page Pulse

An instant page-health auditor. Paste a URL, get back HTTP status, response
time, SEO/accessibility/content/performance signals, and a composite **Pulse
Score** — plus a shareable permalink, a CLI, and live progress streaming.

Built for the Digital Heroes SDE internship task kit (Task A + Task B).

**Live:** `<fill in after deploying — see Deploy below>`
**Repo:** `<fill in your GitHub URL>`

## What's here vs. what the brief asked for

The brief (Task A) asked for: an endpoint that returns status, response time,
title, meta description, H1 count, images missing alt text, and word count,
with a simple frontend and no-crash error handling. That's fully implemented
— see [API contract](#api-contract) and [error handling](#error-handling)
below.

Beyond that, deliberately, as a scope call stated up front (per the brief's
"assumptions are part of the test" rule):

- **Pulse Score** — a composite 0–100 / A–F score across four weighted
  categories (SEO, Accessibility, Performance, Content), each with specific
  notes on what to fix. `lib/score.ts`.
- **Extra audit fields** — Open Graph tags, canonical URL, viewport meta,
  structured data (JSON-LD) count, favicon presence.
- **Shareable, persisted reports** — `POST /api/audit` stores the result and
  returns an `id`; `GET /api/audit/[id]` and the `/report/[id]` page serve it
  back as a public permalink (24h TTL).
- **A CLI companion** (`npm run cli -- <url>`) that hits the exact same
  hosted `POST /api/audit` endpoint — proof the API is a real, reusable
  contract and not something wired to one frontend.
- **Live progress streaming** — `GET /api/audit/stream` (SSE) drives a
  fetching → parsing → scoring UI instead of a bare spinner.

All four reuse one core function, `runAudit()` in `lib/audit.ts` — the web
UI, the plain POST endpoint, the SSE endpoint, and the CLI all call the same
fetch → parse → score pipeline. Nothing is duplicated between "the required
part" and "the extra part."

## Setup

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # Vitest — parsing + scoring unit tests
npm run cli -- https://example.com   # CLI, defaults to localhost:3000
```

Optional — enables persisted/shareable reports, response caching, and rate
limiting. Without these set, the app still works end-to-end; it just returns
each report directly instead of also storing it.

```bash
# .env.local
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

(Free tier at [upstash.com](https://upstash.com) — Redis REST API, no server to run.)

## API contract

### `POST /api/audit`

```json
// Request
{ "url": "https://example.com" }

// Response 200
{
  "id": "ZLXhQsNGgY",
  "cached": false,
  "report": {
    "url": "https://example.com/",
    "auditedAt": "2026-07-24T18:32:43.220Z",
    "status": 200,
    "responseTimeMs": 41,
    "pageSizeBytes": 559,
    "title": "Example Domain",
    "metaDescription": null,
    "h1Count": 1,
    "imagesMissingAlt": 0,
    "wordCount": 17,
    "imagesTotal": 0,
    "canonicalUrl": null,
    "viewportPresent": true,
    "ogTags": { "title": null, "description": null, "image": null },
    "twitterCard": null,
    "structuredDataCount": 0,
    "faviconPresent": true,
    "pulseScore": {
      "overall": 75,
      "grade": "B",
      "categories": {
        "seo": { "score": 40, "notes": ["Missing meta description.", "..."] },
        "accessibility": { "score": 100, "notes": [] },
        "performance": { "score": 100, "notes": [] },
        "content": { "score": 70, "notes": ["Only 17 words — thin content."] }
      }
    }
  }
}
```

### `GET /api/audit/[id]`
Returns `{ id, report }` for a previously stored audit, or `404` if it
expired or was never stored (Redis not configured).

### `GET /api/audit/stream?url=<url>`
Server-Sent Events. Emits `stage` events (`fetching` → `parsing` →
`scoring`) then one `done` event with `{ id, report, cached }`, or one
`error` event with `{ code, message }`. GET, not POST, because browser
`EventSource` can only issue GET requests.

## Error handling

Every failure path returns a typed `{ error: { code, message } }` at the
appropriate HTTP status — nothing throws an unhandled exception up to the
client:

| Situation | Code | Status |
|---|---|---|
| Malformed / non-http(s) URL | `INVALID_URL` | 400 |
| DNS failure, connection refused, etc. | `FETCH_FAILED` | 502 |
| Request exceeds the 8s timeout | `TIMEOUT` | 504 |
| Response isn't `text/html` | `NOT_HTML` | 422 |
| Response exceeds 5MB | `TOO_LARGE` | 413 |
| Stored report expired / never existed | `NOT_FOUND` | 404 |
| Too many requests from one IP (10/min) | `RATE_LIMITED` | 429 |

`lib/parse.ts` is written defensively on top of that: it never assumes a tag
exists (missing `<title>`, no `<h1>`, malformed/unclosed markup, empty
`alt=""` treated the same as a missing `alt` attribute) — see
`lib/__tests__/parse.test.ts` for the exact cases this is tested against.

## Design decisions

**1. One Next.js app instead of separate frontend/backend deployments.**
A single repo and a single Vercel deploy means one live URL, no CORS
configuration, and no risk of the two halves drifting out of sync — while
still keeping a real HTTP boundary (`/api/audit`) that other consumers (the
CLI, in this case) can hit independently. For a tool this size, splitting
services would have added deployment surface without adding capability.

**2. Cheerio over a headless browser for parsing.**
Cheerio parses static HTML fast and with no browser binary to bundle or
deploy — the right tradeoff for a tool whose job is "read the HTML a server
returns." The real cost of that choice: pages that render their content via
client-side JavaScript (SPAs) will under-report word count, H1s, and images,
because Page Pulse never executes the page's JS. That's a stated limitation,
not a silent gap — see "what I'd change" below.

**3. A typed error taxonomy instead of one generic 500.**
Seven distinct failure modes map to seven distinct HTTP statuses and error
codes (table above), decided before writing the fetch logic, not
discovered by accident. This is what "handle failure properly" in the brief
actually cashes out to: a caller (the frontend, the CLI, or someone else's
code hitting this API) can branch on `error.code` instead of guessing from a
message string.

## Testing

`lib/__tests__/parse.test.ts` and `lib/__tests__/score.test.ts` — pure-logic
unit tests, no network calls, run in under a second:

- Happy path: a fully-formed page, asserting every extracted field.
- Failure case 1: an empty document — every field degrades to `null`/`0`
  instead of throwing.
- Failure case 2: images with empty/whitespace-only `alt` attributes are
  correctly counted as missing alt text.
- Plus malformed/unclosed markup, and score-boundary tests (A-grade page,
  F-grade page, and that scores never leave the 0–100 range).

## Deploy

1. Push to a public GitHub repo.
2. Import into [Vercel](https://vercel.com/new) (free tier).
3. Optionally add `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` as
   environment variables for persisted reports + rate limiting.
4. Deploy. The footer credit line ("Built for Digital Heroes Training Task")
   is wired into `app/layout.tsx`, so it's present on every route
   automatically.

## What I'd change with another day / roadmap

**The one real limitation, fixed properly:** Cheerio never executes
JavaScript, so a React/Vue-rendered page gets scored on an empty shell.
With more time I'd add a headless-browser fallback (Playwright) that only
kicks in when the static-HTML word count looks suspiciously low relative to
page size — cheap for the 95% of pages that are server-rendered, accurate
for the rest, instead of paying the Playwright cost on every request.

**Essential functionality that's genuinely missing, not just nice-to-have:**
- **Site-wide crawl**, not just one URL at a time — follow internal links
  (or read `sitemap.xml`) and audit a whole domain in one pass, with a
  worst-offenders list at the end. Right now Page Pulse only ever sees one
  page; almost nobody's problem is one page.
- **Score history** — re-run the same URL over time and chart whether the
  score is actually moving, instead of every audit being a stateless
  snapshot. The Redis layer already stores reports; this is "add a
  `history:<url>` list" away, not a rebuild.
- **Real Core Web Vitals** — the performance category currently proxies
  speed from server response time and payload size, which is honest about
  what it measures but isn't what Lighthouse means by "performance." A
  proper version pulls from the Chrome UX Report API or runs Lighthouse
  itself.
- **Deeper accessibility** — color contrast ratios and ARIA-attribute
  sanity checks, not just alt text and heading structure.
- **A PR bot** — post the audit as a GitHub PR comment or Slack message
  when a page changes, so this stops being a tool you have to remember to
  run and becomes something that runs on you.

**The part that's actually about personality, not features:** right now
the "sharp/technical" voice is baked into fixed strings in `lib/score.ts`.
The obvious next step is making the *voice itself* a feature —
a tone selector (dry-technical / unhinged-roast / drill-sergeant) that
picks which copy bank a finding pulls from, plus a generated, shareable
"roast card" (an OG image, auto-rendered per report) so a bad score is
something people actually want to post rather than a private PDF nobody
sees. That's the direction I'd take "make it unmistakably yours" if this
were a real product instead of a one-day brief — the personality shouldn't
just be in the copy I wrote once, it should be a system the tool can keep
generating more of.

## AI usage

I used Claude Code (Anthropic's agentic CLI, not just chat) across a few
distinct passes rather than one long back-and-forth, and treated each pass
like a different job: first extracting the actual brief from the PDF and
turning it into a requirements checklist; then an architecture pass to
decide the stack and API shape before any code existed; then
implementation; then a separate verification pass — type-checking, linting,
the unit test suite, and driving the app in an actual browser (not just
reading code) to confirm the audit flow, error states, and mobile layout
really worked, not just that they compiled. The design/voice rewrite you
see now was its own later pass too: I looked at the first version, decided
it read as generic AI-dashboard output, and had it rebuilt around a
specific voice and visual identity instead of leaving the default output as
final. What I changed afterward: I reviewed the generated copy in
`lib/score.ts` line by line and will be swapping in more of my own phrasing
before this ships, verified every claim in this README against the actual
running app rather than trusting generated docs, and made the scope calls
myself (what counted as "beyond the brief," what to cut if time ran short)
rather than accepting whatever got proposed first.
