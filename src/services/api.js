// src/services/api.js
// Wrapper for Moderator Center serverless API calls.

const API_BASE =
  import.meta.env.VITE_MOD_API_BASE ||
  import.meta.env.VITE_CHAT_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  "";

const buildApiUrl = (path) => {
  if (!API_BASE) return `/api${path}`;
  if (API_BASE.includes("/.netlify/functions")) return `${API_BASE}${path}`;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
};

const apiFetch = async (path, { method = "GET", body, token } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(buildApiUrl(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || "API request failed";
    throw new Error(msg);
  }
  return json;
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

