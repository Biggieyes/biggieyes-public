import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (path) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("production app access", () => {
  it("keeps the dashboard and panel deep-links publicly reachable", () => {
    const landing = readProjectFile("index.html");
    const appEntry = readProjectFile("app/index.html");
    const netlifyConfig = readProjectFile("netlify.toml");

    expect(landing).toContain("window.__BIGGI_APP_ENABLED__ = true");
    expect(landing).toContain('href="/app/"');
    expect(landing).toContain('/app/?panel=COLLECTION');
    expect(appEntry).not.toContain("window.location.replace(target)");
    expect(netlifyConfig).not.toContain('from = "/app"');
    expect(netlifyConfig).not.toContain('from = "/app/"');
  });

  it("publishes Polygon Mainnet identity without stale testnet references", () => {
    const landing = readProjectFile("index.html");
    const appEntry = readProjectFile("app/index.html");
    const publicLanding = readProjectFile("public-repo/index.html");
    const publicAppEntry = readProjectFile("public-repo/app/index.html");
    const sitemap = readProjectFile("public/sitemap.xml");
    const publicEntries = [landing, appEntry, publicLanding, publicAppEntry];
    const seoRoutes = [
      "collection",
      "vrf-mint",
      "rewards",
      "ecosystem",
      "community-center",
    ];

    for (const entry of publicEntries) {
      expect(entry).toContain("Polygon Mainnet");
      expect(entry).toContain('content="137"');
      expect(entry).not.toMatch(/amoy|mumbai|testnet|80002/i);
    }

    expect(landing).toContain('id="mainnet-verification"');
    expect(landing).toContain("polygonscan.com/address/");
    expect(landing).toContain("opensea.io/collection/");
    expect(sitemap).toContain("https://biggieyes.com/");
    expect(sitemap).toContain("https://biggieyes.com/app/");

    for (const route of seoRoutes) {
      const page = readProjectFile(`public/${route}/index.html`);

      expect(page).toContain("Polygon Mainnet");
      expect(page).toContain('content="137"');
      expect(page).not.toMatch(/amoy|mumbai|testnet|80002/i);
      expect(page).not.toMatch(/href="[^"]*index\.html"/);
      expect(sitemap).toContain(`https://biggieyes.com/${route}/`);
    }
  });
});
