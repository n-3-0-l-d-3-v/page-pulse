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

## What I'd change with another day

<!-- Fill this in yourself before recording the Loom — pick something you
     actually noticed while building, not this placeholder. One real
     candidate: a headless-browser fallback (Playwright) that only kicks in
     when the static-HTML word count looks suspiciously low, so JS-rendered
     pages don't get unfairly scored. -->

## AI usage

<!-- Required by the brief: one short paragraph on where you used AI tools
     and what you changed afterwards. Write this honestly after you've
     actually reviewed/edited the code — don't leave it as a boilerplate
     disclaimer. -->
