import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { runAudit } from "@/lib/audit";
import { AuditError } from "@/lib/errors";
import { getCachedAudit, setCachedAudit, storeReport } from "@/lib/redis";
import { checkRateLimit } from "@/lib/ratelimit";

const bodySchema = z.object({ url: z.string().min(1) });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many audits — try again in a minute." } },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Request body must be JSON with a url field." } },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Body must be { url: string }." } },
      { status: 400 }
    );
  }

  const cached = await getCachedAudit(parsed.data.url);
  if (cached) {
    return NextResponse.json({ id: cached.id, report: cached.report, cached: true });
  }

  try {
    const report = await runAudit(parsed.data.url);
    const id = nanoid(10);
    await storeReport(id, report);
    await setCachedAudit(parsed.data.url, id, report);
    return NextResponse.json({ id, report, cached: false });
  } catch (err) {
    if (err instanceof AuditError) {
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: "Unexpected error auditing that URL." } },
      { status: 502 }
    );
  }
}
