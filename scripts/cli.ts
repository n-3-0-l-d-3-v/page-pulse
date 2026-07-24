#!/usr/bin/env tsx
/**
 * CLI companion to Page Pulse — proves /api/audit is a real, reusable
 * contract rather than something wired only to the one frontend.
 *
 * Usage: pnpm cli <url> [--api https://your-deployment.vercel.app]
 */
import type { AuditReport } from "../lib/audit";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";

function gradeColor(grade: string): string {
  if (grade === "A" || grade === "B") return GREEN;
  if (grade === "C") return YELLOW;
  return RED;
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const url = args.find((a) => !a.startsWith("--"));
  const apiFlagIndex = args.indexOf("--api");
  const api =
    apiFlagIndex >= 0 ? args[apiFlagIndex + 1] : process.env.PAGE_PULSE_API || "http://localhost:3000";
  return { url, api };
}

async function main() {
  const { url, api } = parseArgs(process.argv);

  if (!url) {
    console.error(`${RED}Usage:${RESET} pnpm cli <url> [--api https://your-deployment.vercel.app]`);
    process.exit(1);
  }

  console.log(`${DIM}Auditing ${url} via ${api}...${RESET}`);

  let res: Response;
  try {
    res = await fetch(`${api}/api/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    console.error(`${RED}Could not reach ${api}. Is the server running / URL correct?${RESET}`);
    process.exit(1);
  }

  const body = await res.json();

  if (!res.ok) {
    console.error(`${RED}${BOLD}Audit failed${RESET} [${body.error?.code}]: ${body.error?.message}`);
    process.exit(1);
  }

  const { id, report }: { id: string; report: AuditReport } = body;
  const s = report.pulseScore;

  console.log("");
  console.log(`${BOLD}${report.url}${RESET}`);
  console.log(
    `${gradeColor(s.grade)}${BOLD}Pulse Score: ${s.overall}/100 (${s.grade})${RESET}`
  );
  console.log("");
  console.log(`${CYAN}HTTP status${RESET}        ${report.status}`);
  console.log(`${CYAN}Response time${RESET}      ${report.responseTimeMs}ms`);
  console.log(`${CYAN}Title${RESET}              ${report.title ?? "(missing)"}`);
  console.log(`${CYAN}Meta description${RESET}   ${report.metaDescription ?? "(missing)"}`);
  console.log(`${CYAN}H1 count${RESET}           ${report.h1Count}`);
  console.log(`${CYAN}Images missing alt${RESET} ${report.imagesMissingAlt}/${report.imagesTotal}`);
  console.log(`${CYAN}Word count${RESET}         ${report.wordCount}`);
  console.log("");

  for (const [name, cat] of Object.entries(s.categories)) {
    console.log(`${BOLD}${name.toUpperCase()}${RESET} — ${cat.score}/100`);
    for (const note of cat.notes) console.log(`  ${DIM}- ${note}${RESET}`);
  }

  console.log("");
  console.log(`${DIM}Shareable link: ${api}/report/${id}${RESET}`);
}

main();
