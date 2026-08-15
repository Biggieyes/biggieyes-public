// src/services/api.js
// Wrapper for Moderator Center serverless API calls.

const API_BASE =
  import.meta.env.VITE_MOD_API_BASE ||
  import.meta.env.VITE_CHAT_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  "";
const API_TIMEOUT_MS = (() => {
  const parsed = Number(import.meta.env.VITE_API_TIMEOUT_MS);
  if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  return 12_000;
})();

const buildApiUrl = (path) => {
  if (!API_BASE) return `/api${path}`;
  if (API_BASE.includes("/.netlify/functions")) return `${API_BASE}${path}`;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
};

const createTimeoutController = (timeoutMs = API_TIMEOUT_MS) => {
  if (
    typeof AbortController === "undefined" ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0
  ) {
    return { signal: undefined, clear: () => {}, timeoutMs: 0 };
  }
  const ms = Math.trunc(timeoutMs);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    timeoutMs: ms,
    clear: () => clearTimeout(timer),
  };
};

const apiFetch = async (
  path,
  { method = "GET", body, token, timeoutMs = API_TIMEOUT_MS } = {},
) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const { signal, clear, timeoutMs: effectiveTimeoutMs } =
    createTimeoutController(timeoutMs);
  try {
    const res = await fetch(buildApiUrl(path), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error || json?.message || "API request failed";
      throw new Error(msg);
    }
    return json;
  } catch (error) {
    if (error?.name === "AbortError" && effectiveTimeoutMs > 0) {
      throw new Error(`API request timed out after ${effectiveTimeoutMs} ms`);
    }
    throw error;
  } finally {
    clear();
  }
};

export const getNonce = (address) =>
  apiFetch(`/nonce?address=${encodeURIComponent(address)}`);

export const moderatorLogin = (payload) =>
  apiFetch("/moderatorLogin", { method: "POST", body: payload });

export const adminLogin = (payload) =>
  apiFetch("/adminLogin", { method: "POST", body: payload });

export const registerReferral = (payload) =>
  apiFetch("/registerReferral", { method: "POST", body: payload });

export const requestPasswordReset = (payload) =>
  apiFetch("/requestReset", { method: "POST", body: payload });

export const fetchWeeklySummary = (week) =>
  apiFetch(`/weeklySummary?week=${encodeURIComponent(week)}`);

export const exportWeeklySummary = (week) =>
  apiFetch(`/weeklySummary/export?week=${encodeURIComponent(week)}`);

export const updateWeeklySummary = (payload) =>
  apiFetch("/weeklySummary", { method: "POST", body: payload });

export const postModeratorNote = (payload, token) =>
  apiFetch("/moderatorNote", { method: "POST", body: payload, token });

// Default export for legacy compatibility
export default {
  getNonce,
  moderatorLogin,
  adminLogin,
  registerReferral,
  requestPasswordReset,
  fetchWeeklySummary,
  exportWeeklySummary,
  updateWeeklySummary,
  postModeratorNote,
};

