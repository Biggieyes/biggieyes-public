import axios from "axios";
import Redis from "ioredis";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

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

// Create a rate limiter function. Returns an async function that accepts an optional id
// and resolves to true (allowed) or false (throttled). If `REDIS_URL` is configured,
// uses Redis-backed token bucket; otherwise uses an in-memory fallback.
export const createRateLimiter = ({ capacity = 10, refillMs = 60_000 } = {}) => {
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
        const key = `rate:${String(id || 'global')}`;
        try {
          const now = Date.now();
          const res = await redis.eval(lua, 1, key, now, capacity, refillMs);
          return Number(res) === 1;
        } catch (e) {
          console.error("redis rate limiter error", e?.message || e);
          return true; // fail-open to avoid availability impact
        }
      };
    } catch (e) {
      console.error("Failed to instantiate Redis rate limiter", e?.message || e);
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
