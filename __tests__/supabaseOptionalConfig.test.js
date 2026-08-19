import { describe, expect, it } from "vitest";

describe("optional Supabase frontend configuration", () => {
  it("does not throw when optional moderator/chat variables are missing", async () => {
    const client = await import("../src/supabaseClient.js");

    expect(typeof client.supabaseReady).toBe("boolean");
    if (!client.supabaseReady) expect(client.supabase).toBeNull();
  });
});
