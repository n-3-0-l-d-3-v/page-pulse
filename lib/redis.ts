import { Redis } from "@upstash/redis";
import type { AuditReport } from "./audit";

const REPORT_TTL_SECONDS = 60 * 60 * 24; // 24h
const CACHE_TTL_SECONDS = 60 * 60; // 1h

let client: Redis | null = null;

/**
 * Redis is optional: without env vars configured the app still works,
 * it just skips caching and shareable permalinks (POST /api/audit still
 * returns the report directly). This keeps local dev and the deployed
 * build both functional without forcing a Redis account on anyone
 * re-running this repo.
 */
function getClient(): Redis | null {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  client = new Redis({ url, token });
  return client;
}

export function isRedisConfigured(): boolean {
  return getClient() !== null;
}

export async function storeReport(id: string, report: AuditReport): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  await redis.set(`report:${id}`, JSON.stringify(report), {
    ex: REPORT_TTL_SECONDS,
  });
}

export async function getReport(id: string): Promise<AuditReport | null> {
  const redis = getClient();
  if (!redis) return null;
  const raw = await redis.get<string>(`report:${id}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as AuditReport);
}

function cacheKey(url: string): string {
  return `cache:${url.trim().toLowerCase()}`;
}

export async function getCachedAudit(
  url: string
): Promise<{ id: string; report: AuditReport } | null> {
  const redis = getClient();
  if (!redis) return null;
  const raw = await redis.get<string>(cacheKey(url));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as { id: string; report: AuditReport });
}

export async function setCachedAudit(
  url: string,
  id: string,
  report: AuditReport
): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  await redis.set(cacheKey(url), JSON.stringify({ id, report }), {
    ex: CACHE_TTL_SECONDS,
  });
}
