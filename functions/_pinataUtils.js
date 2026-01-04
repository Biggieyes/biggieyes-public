import axios from "axios";

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

export const createRateLimiter = ({ capacity = 10, refillMs = 60_000 } = {}) => {
  let tokens = capacity;
  let lastRefill = Date.now();
  return () => {
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
