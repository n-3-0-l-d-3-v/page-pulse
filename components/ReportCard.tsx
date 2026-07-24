import type { AuditReport } from "@/lib/audit";
import type { Grade } from "@/lib/score";

const GRADE_LABEL: Record<Grade, string> = {
  A: "Nothing to complain about.",
  B: "Solid. A few loose ends.",
  C: "Functional. Not impressive.",
  D: "This needs real work.",
  F: "Start over.",
};

const CLEAN_NOTE: Record<string, string> = {
  seo: "Search engines have nothing to complain about.",
  accessibility: "Screen readers won't hate you.",
  performance: "Fast enough. Ship it.",
  content: "Enough substance to matter.",
};

function StatLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-[13px]">
      <span className="text-dim">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function CategoryLog({
  id,
  name,
  score,
  notes,
}: {
  id: string;
  name: string;
  score: number;
  notes: string[];
}) {
  const ok = notes.length === 0;
  return (
    <div className="border border-line p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-display font-bold text-sm tracking-tight">{name}</h3>
        <span className={`text-xs font-bold ${ok ? "text-ok" : score < 60 ? "text-bad" : "text-accent"}`}>
          {score}
        </span>
      </div>
      {ok ? (
        <p className="text-[13px] text-ok">
          <span className="text-dim">[OK]</span> {CLEAN_NOTE[id]}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {notes.map((n, i) => (
            <li key={i} className="text-[13px] leading-snug">
              <span className="text-bad">[WARN]</span>{" "}
              <span className="text-foreground/85">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReportCard({ report, id }: { report: AuditReport; id?: string }) {
  const { pulseScore } = report;

  return (
    <div className="space-y-8">
      <div className="text-xs text-dim break-all">
        <span className="text-accent">$</span> audit {report.url}
        <span className="opacity-50"> # {new Date(report.auditedAt).toLocaleString()}</span>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 md:gap-10 items-start">
        <div>
          <div className="font-display font-bold leading-none text-[clamp(5rem,16vw,9rem)] text-accent tabular-nums">
            {pulseScore.overall}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-display font-bold text-2xl">{pulseScore.grade}</span>
            <span className="text-[13px] text-dim">{GRADE_LABEL[pulseScore.grade]}</span>
          </div>
          {id && (
            <p className="mt-6 text-[13px] text-dim break-all">
              share:{" "}
              <a href={`/report/${id}`} className="text-accent hover:underline underline-offset-4">
                {typeof window !== "undefined" ? `${window.location.origin}/report/${id}` : `/report/${id}`}
              </a>
            </p>
          )}
        </div>

        <div className="border border-line divide-y divide-line">
          <div className="p-4">
            <StatLine label="http status" value={report.status} />
            <StatLine label="response time" value={`${report.responseTimeMs}ms`} />
            <StatLine label="page size" value={`${(report.pageSizeBytes / 1024).toFixed(0)}kb`} />
          </div>
          <div className="p-4">
            <StatLine label="title" value={report.title ? `${report.title.length} chars` : "missing"} />
            <StatLine label="meta description" value={report.metaDescription ? `${report.metaDescription.length} chars` : "missing"} />
            <StatLine label="h1 count" value={report.h1Count} />
            <StatLine label="images missing alt" value={`${report.imagesMissingAlt}/${report.imagesTotal}`} />
            <StatLine label="word count" value={report.wordCount} />
          </div>
          <div className="p-4">
            <StatLine label="canonical tag" value={report.canonicalUrl ? "present" : "missing"} />
            <StatLine label="viewport meta" value={report.viewportPresent ? "present" : "missing"} />
            <StatLine label="structured data" value={`${report.structuredDataCount} block(s)`} />
            <StatLine label="favicon" value={report.faviconPresent ? "present" : "missing"} />
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <CategoryLog id="seo" name="SEO" score={pulseScore.categories.seo.score} notes={pulseScore.categories.seo.notes} />
        <CategoryLog id="accessibility" name="ACCESSIBILITY" score={pulseScore.categories.accessibility.score} notes={pulseScore.categories.accessibility.notes} />
        <CategoryLog id="performance" name="PERFORMANCE" score={pulseScore.categories.performance.score} notes={pulseScore.categories.performance.notes} />
        <CategoryLog id="content" name="CONTENT" score={pulseScore.categories.content.score} notes={pulseScore.categories.content.notes} />
      </div>

      {(report.title || report.metaDescription) && (
        <div className="border border-line p-4">
          <p className="text-[11px] text-dim tracking-wide mb-2">HOW IT SHOWS UP IN A SEARCH RESULT</p>
          <p className="text-accent text-lg font-display font-medium">{report.title ?? "(no title)"}</p>
          <p className="text-[13px] text-dim mt-1">{report.metaDescription ?? "(no meta description — Google will write one for you)"}</p>
        </div>
      )}
    </div>
  );
}
