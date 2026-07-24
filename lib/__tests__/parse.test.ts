import { describe, it, expect } from "vitest";
import { parseHtml } from "../parse";

const FULL_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Acme Widgets — Handmade Widgets Since 1990</title>
  <meta name="description" content="Acme Widgets makes handmade widgets for discerning customers across the US and UK." />
  <link rel="canonical" href="https://acme.example/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta property="og:title" content="Acme Widgets" />
  <meta property="og:description" content="Handmade widgets since 1990." />
  <meta property="og:image" content="https://acme.example/og.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/favicon.ico" />
  <script type="application/ld+json">{"@type":"Organization"}</script>
</head>
<body>
  <h1>Welcome to Acme Widgets</h1>
  <p>We make the finest handmade widgets you can buy anywhere in the world today.</p>
  <img src="/hero.jpg" alt="A hero widget on display" />
  <img src="/logo.png" />
  <script>console.log("ignored, not counted as body text")</script>
</body>
</html>
`;

describe("parseHtml — happy path", () => {
  it("extracts all expected fields from a well-formed page", () => {
    const result = parseHtml(FULL_HTML);

    expect(result.title).toBe("Acme Widgets — Handmade Widgets Since 1990");
    expect(result.metaDescription).toContain("handmade widgets");
    expect(result.h1Count).toBe(1);
    expect(result.imagesTotal).toBe(2);
    expect(result.imagesMissingAlt).toBe(1); // the logo has no alt attr
    expect(result.wordCount).toBeGreaterThan(10);
    expect(result.canonicalUrl).toBe("https://acme.example/");
    expect(result.viewportPresent).toBe(true);
    expect(result.ogTags.title).toBe("Acme Widgets");
    expect(result.ogTags.image).toBe("https://acme.example/og.png");
    expect(result.twitterCard).toBe("summary_large_image");
    expect(result.structuredDataCount).toBe(1);
    expect(result.faviconPresent).toBe(true);
  });

  it("does not count script contents toward word count", () => {
    const result = parseHtml(FULL_HTML);
    expect(result.wordCount).toBeLessThan(30);
  });
});

describe("parseHtml — failure cases (must degrade gracefully, never throw)", () => {
  it("handles a completely empty document without throwing", () => {
    expect(() => parseHtml("")).not.toThrow();

    const result = parseHtml("");
    expect(result.title).toBeNull();
    expect(result.metaDescription).toBeNull();
    expect(result.h1Count).toBe(0);
    expect(result.imagesTotal).toBe(0);
    expect(result.imagesMissingAlt).toBe(0);
    expect(result.wordCount).toBe(0);
    expect(result.canonicalUrl).toBeNull();
    expect(result.faviconPresent).toBe(false);
  });

  it("treats an empty alt attribute the same as a missing one", () => {
    const html = `<body><img src="/a.jpg" alt="" /><img src="/b.jpg" alt="   " /></body>`;
    const result = parseHtml(html);

    expect(result.imagesTotal).toBe(2);
    expect(result.imagesMissingAlt).toBe(2);
  });

  it("does not throw on malformed/unclosed markup", () => {
    const brokenHtml = `<html><head><title>Broken</title></head><body><h1>Oops<p>no closing tags anywhere`;
    expect(() => parseHtml(brokenHtml)).not.toThrow();
    const result = parseHtml(brokenHtml);
    expect(result.title).toBe("Broken");
    expect(result.h1Count).toBe(1);
  });
});
