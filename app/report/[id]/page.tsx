import type { Metadata } from "next";
import Link from "next/link";
import { ReportCard } from "@/components/ReportCard";
import { getReport } from "@/lib/redis";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return { title: "404 · Page Pulse" };

  const { grade, overall } = report.pulseScore;
  const host = (() => {
    try {
      return new URL(report.url).hostname;
    } catch {
      return report.url;
    }
  })();

  return { title: `${grade} (${overall}) · ${host} · Page Pulse` };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <p className="text-bad text-sm mb-2">[404]</p>
        <h1 className="font-display font-bold text-2xl">This report is gone.</h1>
        <p className="mt-2 text-dim text-sm">
          Expired (reports live 24 hours) or it never existed in the first place.
        </p>
        <Link href="/" className="mt-6 inline-block text-accent text-sm hover:underline underline-offset-4">
          run a new audit →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-20">
      <Link href="/" className="text-xs text-dim hover:text-accent">
        ← run another audit
      </Link>
      <div className="mt-6">
        <ReportCard report={report} id={id} />
      </div>
    </div>
  );
}
