import type { ParsedPage } from "./parse";

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface CategoryScore {
  score: number; // 0-100
  notes: string[];
}

export interface PulseScore {
  overall: number; // 0-100
  grade: Grade;
  categories: {
    seo: CategoryScore;
    accessibility: CategoryScore;
    performance: CategoryScore;
    content: CategoryScore;
  };
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function gradeFor(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

function scoreSeo(page: ParsedPage): CategoryScore {
  const notes: string[] = [];
  let score = 100;

  if (!page.title) {
    score -= 30;
    notes.push("No <title>. Google has to guess what this page even is.");
  } else if (page.title.length < 10 || page.title.length > 60) {
    score -= 10;
    notes.push(`Title is ${page.title.length} chars — outside the 10-60 sweet spot. Too short reads as lazy, too long gets cut off in results.`);
  }

  if (!page.metaDescription) {
    score -= 25;
    notes.push("No meta description. You're letting Google freestyle your ad copy.");
  } else if (page.metaDescription.length < 50 || page.metaDescription.length > 160) {
    score -= 10;
    notes.push(`Meta description is ${page.metaDescription.length} chars — outside the 50-160 range Google actually shows.`);
  }

  if (!page.canonicalUrl) {
    score -= 10;
    notes.push("No canonical tag. If duplicates of this page exist, good luck.");
  }

  if (!page.ogTags.title || !page.ogTags.description) {
    score -= 15;
    notes.push("Open Graph tags are half-finished. Shared links on Slack or Twitter will look broken.");
  }

  if (page.structuredDataCount === 0) {
    score -= 10;
    notes.push("Zero structured data. AI answer engines have nothing here to cite.");
  }

  return { score: clamp(score), notes };
}

function scoreAccessibility(page: ParsedPage): CategoryScore {
  const notes: string[] = [];
  let score = 100;

  if (page.h1Count === 0) {
    score -= 35;
    notes.push("No <h1>. This page has no headline, technically speaking.");
  } else if (page.h1Count > 1) {
    score -= 15;
    notes.push(`${page.h1Count} <h1> tags. Pick one main point and commit to it.`);
  }

  if (page.imagesTotal > 0) {
    const missingRatio = page.imagesMissingAlt / page.imagesTotal;
    const penalty = Math.round(missingRatio * 50);
    if (penalty > 0) {
      score -= penalty;
      notes.push(
        `${page.imagesMissingAlt}/${page.imagesTotal} images have no alt text. Screen readers skip them, Google can't index them.`
      );
    }
  }

  if (!page.viewportPresent) {
    score -= 15;
    notes.push("No viewport meta tag. This is probably unreadable on a phone right now.");
  }

  return { score: clamp(score), notes };
}

function scorePerformance(responseTimeMs: number, pageSizeBytes: number): CategoryScore {
  const notes: string[] = [];
  let score = 100;

  if (responseTimeMs > 3000) {
    score -= 40;
    notes.push(`${responseTimeMs}ms to respond. Visitors bounce before this finishes loading.`);
  } else if (responseTimeMs > 1000) {
    score -= 15;
    notes.push(`${responseTimeMs}ms to respond — on the slow side of tolerable.`);
  }

  const sizeKb = pageSizeBytes / 1024;
  if (sizeKb > 1500) {
    score -= 30;
    notes.push(`${sizeKb.toFixed(0)}KB of HTML. That's a lot of markup for one page to carry.`);
  } else if (sizeKb > 700) {
    score -= 10;
    notes.push(`${sizeKb.toFixed(0)}KB of HTML — getting heavy.`);
  }

  return { score: clamp(score), notes };
}

function scoreContent(page: ParsedPage): CategoryScore {
  const notes: string[] = [];
  let score = 100;

  if (page.wordCount < 150) {
    score -= 30;
    notes.push(`${page.wordCount} words. Not much here for anyone — human or crawler — to work with.`);
  }

  if (!page.faviconPresent) {
    score -= 10;
    notes.push("No favicon. Every open tab looks the same as the next.");
  }

  return { score: clamp(score), notes };
}

export function scorePage(
  page: ParsedPage,
  meta: { responseTimeMs: number; pageSizeBytes: number }
): PulseScore {
  const seo = scoreSeo(page);
  const accessibility = scoreAccessibility(page);
  const performance = scorePerformance(meta.responseTimeMs, meta.pageSizeBytes);
  const content = scoreContent(page);

  // Weighted: SEO and accessibility carry the most product weight for a
  // small-business audit tool; performance and content round it out.
  const overall = clamp(
    Math.round(
      seo.score * 0.35 +
        accessibility.score * 0.3 +
        performance.score * 0.2 +
        content.score * 0.15
    )
  );

  return {
    overall,
    grade: gradeFor(overall),
    categories: { seo, accessibility, performance, content },
  };
}
