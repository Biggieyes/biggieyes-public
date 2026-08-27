import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN,
};

const restoreEnvValue = (key, value) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};

const setTestSupabaseConfig = () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  process.env.ALLOWED_ORIGIN = "https://biggieyes.com";
};

afterEach(() => {
  restoreEnvValue("SUPABASE_URL", originalEnv.SUPABASE_URL);
  restoreEnvValue(
    "SUPABASE_SERVICE_ROLE_KEY",
    originalEnv.SUPABASE_SERVICE_ROLE_KEY,
  );
  restoreEnvValue("ALLOWED_ORIGIN", originalEnv.ALLOWED_ORIGIN);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("live-chat Netlify functions", () => {
  it("returns a stable 503 response when server credentials are missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();

    const { handler } = await import("../functions/chat-bootstrap.js");
    const response = await handler({ httpMethod: "GET" });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(503);
    expect(body).toEqual({
      ok: false,
      error: "Live chat server configuration is incomplete.",
    });
  });

  it("does not expose a thrown Supabase network error", async () => {
    setTestSupabaseConfig();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    vi.resetModules();

    const { handler } = await import("../functions/chat-bootstrap.js");
    const response = await handler({ httpMethod: "GET" });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(503);
    expect(body.error).toBe("Live chat database is unavailable.");
    expect(response.body).not.toContain("fetch failed");
  });

  it("upserts a nonce against the unique address column", async () => {
    setTestSupabaseConfig();
    const requests = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, init = {}) => {
        const url = typeof input === "string" ? input : input.url;
        const method = init.method || input?.method || "GET";
        requests.push({ url, method });
        if (method === "DELETE") return new Response(null, { status: 204 });
        return new Response(null, { status: 201 });
      }),
    );
    vi.resetModules();

    const { handler } = await import("../functions/nonce.js");
    const response = await handler({
      httpMethod: "POST",
      body: JSON.stringify({
        address: "0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2",
      }),
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(
      requests.some(
        ({ url, method }) =>
          method === "POST" && /[?&]on_conflict=address(?:&|$)/.test(url),
      ),
    ).toBe(true);
  });

  it("supports the legacy nonce schema until the repair migration runs", async () => {
    setTestSupabaseConfig();
    const requests = [];
    let upsertAttempted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, init = {}) => {
        const url = typeof input === "string" ? input : input.url;
        const method = init.method || input?.method || "GET";
        requests.push({ url, method });

        if (method === "POST" && url.includes("on_conflict=address")) {
          upsertAttempted = true;
          return new Response(
            JSON.stringify({
              code: "42P10",
              message:
                "there is no unique or exclusion constraint matching the ON CONFLICT specification",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (method === "DELETE") return new Response(null, { status: 204 });
        return new Response(null, { status: 201 });
      }),
    );
    vi.resetModules();

    const { handler } = await import("../functions/nonce.js");
    const response = await handler({
      httpMethod: "POST",
      body: JSON.stringify({
        address: "0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2",
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(upsertAttempted).toBe(true);
    expect(
      requests.some(
        ({ url, method }) =>
          method === "DELETE" && url.includes("address=eq."),
      ),
    ).toBe(true);
    expect(
      requests.some(
        ({ url, method }) =>
          method === "POST" && !url.includes("on_conflict=address"),
      ),
    ).toBe(true);
  });
});
