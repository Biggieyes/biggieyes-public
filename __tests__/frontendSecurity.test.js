import { afterEach, describe, expect, it, vi } from "vitest";
import { Wallet } from "ethers";

import {
  ADMIN_SIGNATURE_TTL_MS,
  buildChatModerationMessage,
  buildChatRulesMessage,
  isFreshAdminTimestamp,
} from "../src/shared/utils/adminMessageAuth.js";
import {
  httpFromIpfs,
  isSafeRemoteUrl,
} from "../src/shared/services/ipfs.js";

const OWNER = "0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2";
const originalEnv = {
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN,
  CHAT_OWNER_ADDRESS: process.env.CHAT_OWNER_ADDRESS,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
};

function restoreEnvValue(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function configureAdminFunction() {
  process.env.CHAT_OWNER_ADDRESS = OWNER;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    restoreEnvValue(key, value);
  }
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("frontend security boundaries", () => {
  it("rejects unsafe metadata URL schemes and private network targets", () => {
    expect(isSafeRemoteUrl("https://ipfs.io/ipfs/example")).toBe(true);
    expect(isSafeRemoteUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeRemoteUrl("https://127.0.0.1/private")).toBe(false);
    expect(isSafeRemoteUrl("https://192.168.1.10/private")).toBe(false);
    expect(isSafeRemoteUrl("https://[::ffff:127.0.0.1]/private")).toBe(false);
    expect(isSafeRemoteUrl("http://example.com/metadata.json")).toBe(false);
    expect(httpFromIpfs("//example.com/metadata.json")).toBe("");
  });

  it("builds domain-separated admin messages with expiring timestamps", () => {
    const timestamp = Date.now();
    const moderation = buildChatModerationMessage({
      action: "edit",
      messageId: 12,
      newContent: "Updated",
      timestamp,
    });
    const rules = buildChatRulesMessage({ rulesText: "Rules", timestamp });

    expect(moderation).toContain('"domain":"biggieeyes.com"');
    expect(moderation).toContain('"purpose":"chat-moderation"');
    expect(rules).toContain('"purpose":"chat-rules-update"');
    expect(isFreshAdminTimestamp(timestamp)).toBe(true);
    expect(
      isFreshAdminTimestamp(timestamp - ADMIN_SIGNATURE_TTL_MS - 1),
    ).toBe(false);
  });

  it("fails closed when wildcard CORS is configured", async () => {
    process.env.ALLOWED_ORIGIN = "*";
    vi.resetModules();
    const { getAllowedOrigin } = await import(
      "../functions/lib/httpSecurity.js"
    );
    expect(getAllowedOrigin()).toBe("https://biggieyes.com");
  });

  it("fails closed for an insecure non-local CORS origin", async () => {
    process.env.ALLOWED_ORIGIN = "http://example.com";
    vi.resetModules();
    const { getAllowedOrigin } = await import(
      "../functions/lib/httpSecurity.js"
    );
    expect(getAllowedOrigin()).toBe("https://biggieyes.com");
  });

  it("rejects expired chat moderation signatures before database access", async () => {
    configureAdminFunction();
    vi.resetModules();
    const { handler } = await import("../functions/admin/editMessage.js");
    const response = await handler({
      httpMethod: "POST",
      body: JSON.stringify({
        address: OWNER,
        signature: "0xdeadbeef",
        action: "edit",
        messageId: 1,
        newContent: "Updated",
        timestamp: Date.now() - ADMIN_SIGNATURE_TTL_MS - 1,
      }),
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects expired chat rules signatures before database access", async () => {
    configureAdminFunction();
    vi.resetModules();
    const { handler } = await import("../functions/admin/updateRules.js");
    const response = await handler({
      httpMethod: "POST",
      body: JSON.stringify({
        address: OWNER,
        signature: "0xdeadbeef",
        rulesText: "Updated rules",
        timestamp: Date.now() - ADMIN_SIGNATURE_TTL_MS - 1,
      }),
    });

    expect(response.statusCode).toBe(400);
  });

  it("accepts a fresh domain-separated owner signature", async () => {
    const wallet = new Wallet(`0x${"11".repeat(32)}`);
    process.env.CHAT_OWNER_ADDRESS = wallet.address;
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input, init = {}) => {
        const method = String(init?.method || "GET").toUpperCase();
        return new Response(null, { status: method === "PATCH" ? 204 : 201 });
      }),
    );
    vi.resetModules();

    const timestamp = Date.now();
    const rulesText = "Be respectful.";
    const signature = await wallet.signMessage(
      buildChatRulesMessage({ rulesText, timestamp }),
    );
    const { handler } = await import("../functions/admin/updateRules.js");
    const response = await handler({
      httpMethod: "POST",
      body: JSON.stringify({
        address: wallet.address,
        signature,
        rulesText,
        timestamp,
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });
});
