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
});
