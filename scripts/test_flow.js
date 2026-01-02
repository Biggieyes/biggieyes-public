// scripts/test_flow.js
// Manual test script for nonce -> message -> replay -> admin edit flow.
import { Wallet } from "ethers";

const BASE_URL = process.env.CHAT_BASE_URL || "http://localhost:3000";
const buildApiUrl = (path) => {
  if (!BASE_URL) return `/api${path}`;
  if (BASE_URL.includes("/.netlify/functions")) return `${BASE_URL}${path}`;
  return `${BASE_URL}/api${path}`;
};
const OWNER_PRIV = process.env.CHAT_OWNER_PRIVATE_KEY || "";

const json = async (res) => {
  try {
    return await res.json();
  } catch {
    return {};
  }
};

const post = async (path, body) => {
  const res = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { res, data: await json(res) };
};

async function run() {
  console.log("Base URL:", BASE_URL);
  const wallet = Wallet.createRandom();
  const address = wallet.address;
  console.log("Test wallet:", address);

  const nonceRes = await post("/api/nonce", { address });
  console.log("nonce:", nonceRes.data);
  if (!nonceRes.data?.nonce) throw new Error("Nonce missing");

  const content = "Hello from test_flow";
  const timestamp = Date.now();
  const payload = `${nonceRes.data.nonce}|${content}|${timestamp}`;
  const signature = await wallet.signMessage(payload);

  const msgRes = await post("/api/message", {
    address,
    content,
    signature,
    nonce: nonceRes.data.nonce,
    timestamp,
    name: "TestUser",
  });
  console.log("message:", msgRes.data);

  const rateNonce = await post("/api/nonce", { address });
  const ratePayload = `${rateNonce.data.nonce}|${content}|${Date.now()}`;
  const rateSig = await wallet.signMessage(ratePayload);
  const rateRes = await post("/api/message", {
    address,
    content,
    signature: rateSig,
    nonce: rateNonce.data.nonce,
    timestamp: Date.now(),
  });
  console.log("rate limit:", rateRes.data);

  const replayRes = await post("/api/message", {
    address,
    content,
    signature,
    nonce: nonceRes.data.nonce,
    timestamp,
    name: "ReplayUser",
  });
  console.log("replay:", replayRes.data);

  const badRes = await post("/api/message", {
    address,
    content,
    signature: "0xdeadbeef",
    nonce: "badnonce",
    timestamp: Date.now(),
  });
  console.log("bad signature:", badRes.data);

  if (OWNER_PRIV && msgRes.data?.id) {
    const owner = new Wallet(OWNER_PRIV);
    const action = "edit";
    const messageId = msgRes.data.id;
    const newContent = "Edited by owner";
    const adminPayload = `${action}|${messageId}|${newContent}`;
    const adminSig = await owner.signMessage(adminPayload);
    const editRes = await post("/api/admin/editMessage", {
      address: owner.address,
      signature: adminSig,
      action,
      messageId,
      newContent,
    });
    console.log("admin edit:", editRes.data);
  } else {
    console.log("Owner private key missing, skipping admin test.");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
