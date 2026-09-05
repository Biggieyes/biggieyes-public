import axios from "axios";
import { createHash } from "node:crypto";
import { getAddress, verifyMessage } from "ethers";
import Redis from "ioredis";
import { buildApiHeaders } from "./lib/httpSecurity.js";
import {
  buildPinataUploadMessage,
  PINATA_UPLOAD_SIGNATURE_TTL_MS,
} from "../src/shared/utils/pinataUploadAuth.js";

const DEFAULT_PINATA_GATEWAY_BASE = "https://biggieyes.mypinata.cloud";

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function getHeader(headers, key) {
  if (!headers || !key) return "";
  const matchKey = Object.keys(headers).find(
    (k) => String(k).toLowerCase() === String(key).toLowerCase(),
  );
  return matchKey ? headers[matchKey] : "";
}

export const corsHeaders = buildApiHeaders({
  methods: "POST,OPTIONS",
  allowedHeaders:
    "Content-Type,Authorization,X-Biggi-Address,X-Biggi-Timestamp,X-Biggi-Signature",
});

export const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", ...corsHeaders },
  body: JSON.stringify(body),
});

export const parseJsonBody = (event) => {
  if (!event?.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

function getRawBodyBuffer(event) {
  if (!event?.body) return Buffer.alloc(0);
  return event.isBase64Encoded
    ? Buffer.from(event.body, "base64")
    : Buffer.from(String(event.body), "utf8");
}

export const authorizePinataUpload = (event, operation) => {
  const configuredOwner =
    process.env.PINATA_UPLOAD_OWNER_ADDRESS ||
    process.env.CHAT_OWNER_ADDRESS ||
    "";

  if (!configuredOwner) {
    return {
      ok: false,
      statusCode: 503,
      error: "Pinata upload owner is not configured",
    };
  }

  const claimedAddressRaw = String(
    getHeader(event?.headers, "x-biggi-address") || "",
  );
  const timestamp = String(
    getHeader(event?.headers, "x-biggi-timestamp") || "",
  );
  const signature = String(
    getHeader(event?.headers, "x-biggi-signature") || "",
  );
  if (!claimedAddressRaw || !timestamp || !signature) {
    return {
      ok: false,
      statusCode: 401,
      error: "Missing upload authorization",
    };
  }

  try {
    const owner = getAddress(configuredOwner);
    const claimedAddress = getAddress(claimedAddressRaw);
    const timestampMs = Number(timestamp);

    if (!Number.isSafeInteger(timestampMs)) {
      throw new Error("Invalid upload timestamp");
    }
    if (Math.abs(Date.now() - timestampMs) > PINATA_UPLOAD_SIGNATURE_TTL_MS) {
      throw new Error("Upload signature expired");
    }
    if (claimedAddress !== owner) {
      return { ok: false, statusCode: 403, error: "Owner wallet required" };
    }

    const bodyHash = `0x${createHash("sha256")
      .update(getRawBodyBuffer(event))
      .digest("hex")}`;
    const message = buildPinataUploadMessage({
      operation,
      timestamp,
      bodyHash,
    });
    const recoveredAddress = getAddress(verifyMessage(message, signature));

    if (recoveredAddress !== owner) {
      return { ok: false, statusCode: 403, error: "Invalid owner signature" };
    }

    return { ok: true, address: owner };
  } catch {
    return {
      ok: false,
      statusCode: 401,
      error: "Invalid upload authorization",
    };
  }
};

// Create a rate limiter function. Returns an async function that accepts an optional id
// and resolves to true (allowed) or false (throttled). If `REDIS_URL` is configured,
// uses Redis-backed token bucket; otherwise uses an in-memory fallback.
export const createRateLimiter = ({
  capacity = 10,
  refillMs = 60_000,
} = {}) => {
  const REDIS_URL = process.env.REDIS_URL || "";
  if (REDIS_URL) {
    try {
      const redis = new Redis(REDIS_URL);
      const lua = `
        local tokens_key = KEYS[1] .. ':tokens'
        local ts_key = KEYS[1] .. ':ts'
        local now = tonumber(ARGV[1])
        local capacity = tonumber(ARGV[2])
        local refill_ms = tonumber(ARGV[3])
        local tokens = tonumber(redis.call('get', tokens_key) or capacity)
        local last = tonumber(redis.call('get', ts_key) or now)
        local elapsed = math.max(0, now - last)
        local add = math.floor(elapsed / refill_ms * capacity)
        if add > 0 then
          tokens = math.min(capacity, tokens + add)
          redis.call('set', tokens_key, tokens)
          redis.call('set', ts_key, now)
        end
        if tokens <= 0 then
          return 0
        end
        redis.call('decr', tokens_key)
        return 1
      `;

      return async (id = "global") => {
        const key = `rate:${String(id || "global")}`;
        try {
          const now = Date.now();
          const res = await redis.eval(lua, 1, key, now, capacity, refillMs);
          return Number(res) === 1;
        } catch (e) {
          console.error("redis rate limiter error", e?.message || e);
          return false;
        }
      };
    } catch (e) {
      console.error(
        "Failed to instantiate Redis rate limiter",
        e?.message || e,
      );
      // fallthrough to in-memory fallback
    }
  }

  // In-memory fallback (per-instance, not suitable for multi-instance)
  let tokens = capacity;
  let lastRefill = Date.now();
  return async () => {
    const now = Date.now();
    const elapsed = now - lastRefill;
    if (elapsed > 0) {
      const refill = (elapsed / refillMs) * capacity;
      if (refill >= 1) {
        tokens = Math.min(capacity, tokens + refill);
        lastRefill = now;
      }
    }
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
};

export const buildPinataHeaders = () => {
  const jwt = process.env.PINATA_JWT || "";
  if (jwt) return { Authorization: `Bearer ${jwt}` };
  const apiKey = process.env.PINATA_API_KEY || "";
  const secret = process.env.PINATA_SECRET_API_KEY || "";
  if (!apiKey || !secret) {
    throw new Error("Missing Pinata API credentials");
  }
  return {
    pinata_api_key: apiKey,
    pinata_secret_api_key: secret,
  };
};

export const pinataRequest = async (url, data, headers) => {
  return axios.post(url, data, { headers, timeout: 120_000 });
};

export const getRequestClientId = (event) => {
  const headers = event?.headers || {};
  const fromHeader =
    getHeader(headers, "x-forwarded-for") ||
    getHeader(headers, "x-real-ip") ||
    getHeader(headers, "cf-connecting-ip") ||
    getHeader(headers, "origin") ||
    "global";
  return String(fromHeader).split(",")[0].trim() || "global";
};

export const buildPinataGatewayUrl = (cid) => {
  const cleanCid = String(cid || "")
    .trim()
    .replace(/^ipfs:\/\//i, "")
    .replace(/^\/?ipfs\//i, "");
  if (!cleanCid) return "";
  const gatewayBase = trimSlash(
    process.env.PINATA_GATEWAY_BASE_URL ||
      process.env.PINATA_GATEWAY_URL ||
      DEFAULT_PINATA_GATEWAY_BASE,
  );
  return `${gatewayBase}/ipfs/${cleanCid}`;
};

export const isTrueEnv = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};
