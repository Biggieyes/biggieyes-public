import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
  },
}));

import axios from "axios";
import { handler as pinFileHandler } from "../functions/pinFile.js";
import { handler as pinJsonHandler } from "../functions/pinJson.js";

const mockPost = axios.post;

const buildEvent = (body) => ({
  httpMethod: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
  isBase64Encoded: false,
});

beforeEach(() => {
  mockPost.mockReset();
  process.env.PINATA_API_KEY = "test_key";
  process.env.PINATA_SECRET_API_KEY = "test_secret";
  delete process.env.PINATA_JWT;
  delete process.env.NFT_STORAGE_KEY;
});

describe("pinFile function", () => {
  it("returns cid on success", async () => {
    mockPost.mockResolvedValueOnce({ data: { IpfsHash: "bafy-test-cid" } });

    const base64 = Buffer.from("hello").toString("base64");
    const event = buildEvent({
      name: "test.png",
      contentBase64: `data:image/png;base64,${base64}`,
    });

    const res = await pinFileHandler(event);
    const json = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(json.success).toBe(true);
    expect(json.cid).toBe("bafy-test-cid");
  });

  it("rejects unsupported file types", async () => {
    const base64 = Buffer.from("hello").toString("base64");
    const event = buildEvent({
      name: "note.txt",
      contentBase64: `data:text/plain;base64,${base64}`,
    });

    const res = await pinFileHandler(event);
    const json = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(json.success).toBe(false);
  });
});

describe("pinJson function", () => {
  it("returns 500 on pinata error", async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 500, data: { error: "Pinata error" } },
    });

    const event = buildEvent({
      metadata: { name: "Test", image: "ipfs://bafy" },
    });

    const res = await pinJsonHandler(event);
    const json = JSON.parse(res.body);

    expect(res.statusCode).toBe(500);
    expect(json.success).toBe(false);
  });
});
