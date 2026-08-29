// @vitest-environment node
import axios from "axios";
import { Wallet, sha256, toUtf8Bytes } from "ethers";
import { handler as pinFileHandler } from "../functions/pinFile.js";
import { handler as pinJsonHandler } from "../functions/pinJson.js";
import { buildPinataUploadMessage } from "../src/shared/utils/pinataUploadAuth.js";

let mockPost;
const owner = new Wallet(`0x${"11".repeat(32)}`);

const buildEvent = async (body, operation) => {
  const bodyText = JSON.stringify(body);
  const timestamp = String(Date.now());
  const bodyHash = sha256(toUtf8Bytes(bodyText));
  const signature = await owner.signMessage(
    buildPinataUploadMessage({ operation, timestamp, bodyHash }),
  );

  return {
    httpMethod: "POST",
    headers: {
      "content-type": "application/json",
      "x-biggi-address": owner.address,
      "x-biggi-timestamp": timestamp,
      "x-biggi-signature": signature,
    },
    body: bodyText,
    isBase64Encoded: false,
  };
};

beforeEach(() => {
  mockPost = vi.fn();
  axios.post = mockPost;
  process.env.PINATA_API_KEY = "test_key";
  process.env.PINATA_SECRET_API_KEY = "test_secret";
  process.env.CHAT_OWNER_ADDRESS = owner.address;
  delete process.env.PINATA_JWT;
  delete process.env.PINATA_UPLOAD_OWNER_ADDRESS;
  delete process.env.NFT_STORAGE_KEY;
});

describe("pinFile function", () => {
  it("returns cid on success", async () => {
    mockPost.mockResolvedValueOnce({ data: { IpfsHash: "bafy-test-cid" } });

    const base64 = Buffer.from("hello").toString("base64");
    const event = await buildEvent(
      {
        name: "test.png",
        contentBase64: `data:image/png;base64,${base64}`,
      },
      "pinFile",
    );

    const res = await pinFileHandler(event);
    const json = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(json.success).toBe(true);
    expect(json.cid).toBe("bafy-test-cid");
  });

  it("rejects unsupported file types", async () => {
    const base64 = Buffer.from("hello").toString("base64");
    const event = await buildEvent(
      {
        name: "note.txt",
        contentBase64: `data:text/plain;base64,${base64}`,
      },
      "pinFile",
    );

    const res = await pinFileHandler(event);
    const json = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(json.success).toBe(false);
  });
});

describe("pinJson function", () => {
  it("rejects requests without an owner signature", async () => {
    const body = JSON.stringify({ metadata: { name: "Unsigned" } });
    const res = await pinJsonHandler({
      httpMethod: "POST",
      headers: { "content-type": "application/json" },
      body,
      isBase64Encoded: false,
    });

    expect(res.statusCode).toBe(401);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("rejects a request body changed after signing", async () => {
    const event = await buildEvent(
      { metadata: { name: "Original" } },
      "pinJson",
    );
    event.body = JSON.stringify({ metadata: { name: "Changed" } });

    const res = await pinJsonHandler(event);

    expect(res.statusCode).toBe(403);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("returns 500 on pinata error", async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 500, data: { error: "Pinata error" } },
    });

    const event = await buildEvent(
      { metadata: { name: "Test", image: "ipfs://bafy" } },
      "pinJson",
    );

    const res = await pinJsonHandler(event);
    const json = JSON.parse(res.body);

    expect(res.statusCode).toBe(500);
    expect(json.success).toBe(false);
  });
});
