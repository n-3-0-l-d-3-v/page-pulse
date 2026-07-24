"use client";

import { useRef, useState } from "react";
import { ReportCard } from "@/components/ReportCard";
import type { AuditReport } from "@/lib/audit";

type Stage = "idle" | "fetching" | "parsing" | "scoring" | "done" | "error";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  fetching: "fetching…",
  parsing: "reading the markup…",
  scoring: "judging it…",
  done: "done",
  error: "failed",
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; report: AuditReport } | null>(null);
  const esRef = useRef<EventSource | null>(null);

  function runAudit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    esRef.current?.close();
    setError(null);
    setResult(null);
    setStage("fetching");

    const es = new EventSource(`/api/audit/stream?url=${encodeURIComponent(url.trim())}`);
    esRef.current = es;

    es.addEventListener("stage", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setStage(data.stage);
    });

    es.addEventListener("done", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setResult({ id: data.id, report: data.report });
      setStage("done");
      es.close();
    });

    es.addEventListener("error", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setError(data.message ?? "Something went wrong.");
      } catch {
        setError("Connection lost while auditing.");
      }
      setStage("error");
      es.close();
    });
  }

  const isRunning = stage !== "idle" && stage !== "done" && stage !== "error";

  return (
    <div className="max-w-3xl mx-auto px-4 py-14 sm:py-24">
      <p className="text-xs text-dim mb-3">{"// page health, no sugarcoating"}</p>
      <h1 className="font-display font-bold tracking-tight text-[clamp(2.5rem,7vw,4rem)] leading-[0.95]">
        Page Pulse
      </h1>
      <p className="mt-4 text-[15px] text-dim max-w-md">
        Paste a URL. It fetches the page, reads the markup, and tells you
        straight what&apos;s wrong with it — SEO, accessibility, performance,
        content. No filler, no &quot;great job!&quot; for a page that isn&apos;t.
      </p>

      <form onSubmit={runAudit} className="mt-10 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center border border-line px-4 focus-within:border-accent">
          <span className="text-accent mr-2 text-sm">$</span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-dim"
          />
        </div>
        <button
          type="submit"
          disabled={isRunning}
          className="border border-accent bg-accent px-6 py-3 text-sm font-bold text-background disabled:opacity-40 disabled:cursor-not-allowed hover:bg-transparent hover:text-accent transition-colors"
        >
          {isRunning ? STAGE_LABEL[stage] : "run audit →"}
        </button>
      </form>

      {error && (
        <p className="mt-6 text-sm text-bad">
          <span className="text-dim">[FAIL]</span> {error}
        </p>
      )}

      {result && (
        <div className="mt-14">
          <ReportCard report={result.report} id={result.id} />
        </div>
      )}
    </div>
  );
}
