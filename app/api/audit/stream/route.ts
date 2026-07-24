import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { runAudit, type AuditStage } from "@/lib/audit";
import { AuditError } from "@/lib/errors";
import { getCachedAudit, setCachedAudit, storeReport } from "@/lib/redis";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * GET (not POST) because browser EventSource can only issue GET requests.
 * Same runAudit() core as the plain POST route — this is a UX layer on
 * top of the same contract, not a separate implementation.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(new TextEncoder().encode(sseEvent(event, data)));

      if (!url) {
        send("error", { code: "INVALID_URL", message: "Missing url query param." });
        controller.close();
        return;
      }

      const allowed = await checkRateLimit(ip);
      if (!allowed) {
        send("error", { code: "RATE_LIMITED", message: "Too many audits — try again in a minute." });
        controller.close();
        return;
      }

      const cached = await getCachedAudit(url);
      if (cached) {
        send("stage", { stage: "fetching" satisfies AuditStage });
        send("stage", { stage: "parsing" satisfies AuditStage });
        send("stage", { stage: "scoring" satisfies AuditStage });
        send("done", { id: cached.id, report: cached.report, cached: true });
        controller.close();
        return;
      }

      try {
        const report = await runAudit(url, (stage) => send("stage", { stage }));
        const id = nanoid(10);
        await storeReport(id, report);
        await setCachedAudit(url, id, report);
        send("done", { id, report, cached: false });
      } catch (err) {
        if (err instanceof AuditError) {
          send("error", { code: err.code, message: err.message });
        } else {
          send("error", { code: "FETCH_FAILED", message: "Unexpected error auditing that URL." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
