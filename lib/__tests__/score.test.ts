import { describe, it, expect } from "vitest";
import { scorePage } from "../score";
import type { ParsedPage } from "../parse";

function basePage(overrides: Partial<ParsedPage> = {}): ParsedPage {
  return {
    title: "A Good Title Between Ten And Sixty Characters",
    metaDescription:
      "A meta description that comfortably sits within the fifty to one hundred sixty character sweet spot for search engines.",
    h1Count: 1,
    imagesTotal: 4,
    imagesMissingAlt: 0,
    wordCount: 600,
    canonicalUrl: "https://example.com/",
    viewportPresent: true,
    ogTags: { title: "OG Title", description: "OG description", image: "https://example.com/og.png" },
    twitterCard: "summary",
    structuredDataCount: 1,
    faviconPresent: true,
    ...overrides,
  };
}

describe("scorePage", () => {
  it("gives a near-perfect page an A grade", () => {
    const result = scorePage(basePage(), { responseTimeMs: 300, pageSizeBytes: 50_000 });
    expect(result.overall).toBeGreaterThanOrEqual(90);
    expect(result.grade).toBe("A");
  });

  it("penalizes a page with no h1 and missing alt text heavily on accessibility", () => {
    const result = scorePage(
      basePage({ h1Count: 0, imagesMissingAlt: 4 }),
      { responseTimeMs: 300, pageSizeBytes: 50_000 }
    );
    expect(result.categories.accessibility.score).toBeLessThan(50);
    expect(result.categories.accessibility.notes.length).toBeGreaterThan(0);
  });

  it("penalizes missing title and meta description on SEO", () => {
    const result = scorePage(
      basePage({ title: null, metaDescription: null, canonicalUrl: null }),
      { responseTimeMs: 300, pageSizeBytes: 50_000 }
    );
    expect(result.categories.seo.score).toBeLessThan(50);
  });

  it("penalizes slow response times and heavy payloads on performance", () => {
    const result = scorePage(basePage(), { responseTimeMs: 5000, pageSizeBytes: 2_000_000 });
    expect(result.categories.performance.score).toBeLessThan(50);
  });

  it("never returns a score outside 0-100", () => {
    const result = scorePage(
      basePage({
        title: null,
        metaDescription: null,
        canonicalUrl: null,
        ogTags: { title: null, description: null, image: null },
        structuredDataCount: 0,
        h1Count: 0,
        imagesMissingAlt: 10,
        imagesTotal: 10,
        viewportPresent: false,
        wordCount: 0,
        faviconPresent: false,
      }),
      { responseTimeMs: 10_000, pageSizeBytes: 5_000_000 }
    );
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.grade).toBe("F");
  });
});
