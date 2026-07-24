import * as cheerio from "cheerio";

export interface ParsedPage {
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  imagesTotal: number;
  imagesMissingAlt: number;
  wordCount: number;
  canonicalUrl: string | null;
  viewportPresent: boolean;
  ogTags: { title: string | null; description: string | null; image: string | null };
  twitterCard: string | null;
  structuredDataCount: number;
  faviconPresent: boolean;
}

/**
 * Pure parsing over raw HTML — no network I/O — so it's unit-testable
 * against fixtures without hitting the internet.
 */
export function parseHtml(html: string): ParsedPage {
  const $ = cheerio.load(html);

  const title = $("head > title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;

  const h1Count = $("h1").length;

  const images = $("img");
  const imagesTotal = images.length;
  let imagesMissingAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt === undefined || alt.trim() === "") imagesMissingAlt++;
  });

  const bodyText = $("body").clone();
  bodyText.find("script, style, noscript").remove();
  const text = bodyText.text().replace(/\s+/g, " ").trim();
  const wordCount = text.length === 0 ? 0 : text.split(" ").length;

  const canonicalUrl = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const viewportPresent = $('meta[name="viewport"]').length > 0;

  const ogTags = {
    title: $('meta[property="og:title"]').attr("content")?.trim() || null,
    description:
      $('meta[property="og:description"]').attr("content")?.trim() || null,
    image: $('meta[property="og:image"]').attr("content")?.trim() || null,
  };

  const twitterCard =
    $('meta[name="twitter:card"]').attr("content")?.trim() || null;

  const structuredDataCount = $('script[type="application/ld+json"]').length;

  const faviconPresent =
    $('link[rel="icon"]').length > 0 ||
    $('link[rel="shortcut icon"]').length > 0;

  return {
    title,
    metaDescription,
    h1Count,
    imagesTotal,
    imagesMissingAlt,
    wordCount,
    canonicalUrl,
    viewportPresent,
    ogTags,
    twitterCard,
    structuredDataCount,
    faviconPresent,
  };
}
