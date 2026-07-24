import { AuditError } from "./errors";
import { parseHtml, type ParsedPage } from "./parse";
import { scorePage, type PulseScore } from "./score";

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export type AuditStage = "fetching" | "parsing" | "scoring" | "done";

export interface AuditReport {
  url: string;
  auditedAt: string;
  status: number;
  responseTimeMs: number;
  pageSizeBytes: number;

  // Required by the brief
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  imagesMissingAlt: number;
  wordCount: number;

  // Extra fields (Tier 1 — beyond the literal brief)
  imagesTotal: number;
  canonicalUrl: string | null;
  viewportPresent: boolean;
  ogTags: ParsedPage["ogTags"];
  twitterCard: string | null;
  structuredDataCount: number;
  faviconPresent: boolean;

  pulseScore: PulseScore;
}

function validateUrl(input: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new AuditError("INVALID_URL", "That is not a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AuditError("INVALID_URL", "URL must use http or https.");
  }
  return parsed;
}

/**
 * Fetch + parse + score a URL. Optional onStage callback lets callers
 * (the SSE route) surface progress without duplicating this logic —
 * the plain POST /api/audit route just calls this without a callback.
 */
export async function runAudit(
  rawUrl: string,
  onStage?: (stage: AuditStage) => void
): Promise<AuditReport> {
  const url = validateUrl(rawUrl);

  onStage?.("fetching");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const start = performance.now();
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "PagePulse/1.0 (+https://digitalheroesco.com)",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AuditError("TIMEOUT", `Request timed out after ${FETCH_TIMEOUT_MS}ms.`);
    }
    throw new AuditError("FETCH_FAILED", "Could not reach that URL.");
  } finally {
    clearTimeout(timeout);
  }
  const responseTimeMs = Math.round(performance.now() - start);

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    throw new AuditError(
      "NOT_HTML",
      `Expected an HTML page, got content-type "${contentType || "unknown"}".`
    );
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES) {
    throw new AuditError("TOO_LARGE", "Page exceeds the 5MB size limit.");
  }

  const html = await response.text();
  const pageSizeBytes = Buffer.byteLength(html, "utf-8");
  if (pageSizeBytes > MAX_BYTES) {
    throw new AuditError("TOO_LARGE", "Page exceeds the 5MB size limit.");
  }

  onStage?.("parsing");
  const parsed = parseHtml(html);

  onStage?.("scoring");
  const pulseScore = scorePage(parsed, { responseTimeMs, pageSizeBytes });

  const report: AuditReport = {
    url: url.toString(),
    auditedAt: new Date().toISOString(),
    status: response.status,
    responseTimeMs,
    pageSizeBytes,
    title: parsed.title,
    metaDescription: parsed.metaDescription,
    h1Count: parsed.h1Count,
    imagesMissingAlt: parsed.imagesMissingAlt,
    wordCount: parsed.wordCount,
    imagesTotal: parsed.imagesTotal,
    canonicalUrl: parsed.canonicalUrl,
    viewportPresent: parsed.viewportPresent,
    ogTags: parsed.ogTags,
    twitterCard: parsed.twitterCard,
    structuredDataCount: parsed.structuredDataCount,
    faviconPresent: parsed.faviconPresent,
    pulseScore,
  };

  onStage?.("done");
  return report;
}
