const API_BASE =
  import.meta.env.VITE_COMMUNITY_API_BASE ||
  import.meta.env.VITE_CHAT_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_MOD_API_BASE ||
  "";

const API_TIMEOUT_MS = (() => {
  const parsed = Number(
    import.meta.env.VITE_COMMUNITY_API_TIMEOUT_MS ||
      import.meta.env.VITE_CHAT_API_TIMEOUT_MS ||
      import.meta.env.VITE_API_TIMEOUT_MS,
  );
  if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  return 12_000;
})();

function normalizeApiPath(path) {
  const safe = String(path || "").trim();
  if (!safe) return "";
  return safe.startsWith("/") ? safe : `/${safe}`;
}

function buildApiCandidates(path) {
  const safePath = normalizeApiPath(path);
  if (!safePath) return [];

  const add = (list, value) => {
    const item = String(value || "").trim();
    if (item && !list.includes(item)) list.push(item);
  };

  const buildFromBase = (baseInput) => {
    const list = [];
    const base = String(baseInput || "").replace(/\/+$/, "");
    if (!base) {
      add(list, `/api${safePath}`);
      add(list, `/.netlify/functions${safePath}`);
      return list;
    }

    if (base.includes("/.netlify/functions")) {
      add(list, `${base}${safePath}`);
      const root = base.replace(/\/\.netlify\/functions$/i, "");
      add(list, `${root || ""}/api${safePath}`);
      return list;
    }

    if (/\/api$/i.test(base)) {
      add(list, `${base}${safePath}`);
      const root = base.replace(/\/api$/i, "");
      add(list, `${root}/.netlify/functions${safePath}`);
      return list;
    }

    add(list, `${base}/api${safePath}`);
    add(list, `${base}/.netlify/functions${safePath}`);
    add(list, `${base}${safePath}`);
    return list;
  };

  const merged = [];
  buildFromBase(API_BASE).forEach((candidate) => add(merged, candidate));
  buildFromBase("").forEach((candidate) => add(merged, candidate));
  return merged;
}

async function fetchJsonWithTimeout(
  urlOrUrls,
  { timeoutMs = API_TIMEOUT_MS, ...options } = {},
) {
  const candidates = (Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (!candidates.length) {
    throw new Error("Community voting API is not configured.");
  }

  const ms = Number.isFinite(Number(timeoutMs))
    ? Math.max(0, Math.trunc(Number(timeoutMs)))
    : 0;

  let lastError = null;
  for (let idx = 0; idx < candidates.length; idx += 1) {
    const url = candidates[idx];
    const controller =
      typeof AbortController !== "undefined" && ms > 0
        ? new AbortController()
        : null;
    const timer = controller ? setTimeout(() => controller.abort(), ms) : null;
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller?.signal,
        cache: "no-store",
      });
      const raw = await response.text();
      let json = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        json = {};
      }

      if (!response.ok) {
        const snippet =
          typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 140) : "";
        const reason =
          json?.error || json?.message || snippet || `HTTP ${response.status}`;
        const error = new Error(`HTTP ${response.status}: ${reason}`);
        error.status = response.status;
        throw error;
      }
      return json;
    } catch (error) {
      if (error?.name === "AbortError" && ms > 0) {
        lastError = new Error(`Endpoint timeout after ${ms} ms`);
        break;
      }
      lastError = error;
      const status = Number(error?.status);
      const shouldTryNext =
        idx < candidates.length - 1 && (status === 404 || status === 405);
      if (!shouldTryNext) break;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw lastError || new Error("Community voting request failed");
}

export async function fetchCommunityPolls({
  walletAddress = "",
  includeAll = false,
} = {}) {
  const params = new URLSearchParams();
  if (walletAddress) params.set("address", walletAddress);
  if (includeAll) params.set("includeAll", "1");
  const suffix = params.toString();
  const path = `/communityVoting${suffix ? `?${suffix}` : ""}`;
  const json = await fetchJsonWithTimeout(buildApiCandidates(path), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!json?.ok) throw new Error(json?.error || "Failed to load polls");
  return json;
}

export async function submitCommunityVote({ address, payload, signature }) {
  const json = await fetchJsonWithTimeout(buildApiCandidates("/communityVoting"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, payload, signature }),
  });
  if (!json?.ok) throw new Error(json?.error || "Vote failed");
  return json;
}

export async function submitCommunityPollAdminAction({
  address,
  payload,
  signature,
}) {
  const json = await fetchJsonWithTimeout(
    buildApiCandidates("/admin/communityVoting"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, payload, signature }),
    },
  );
  if (!json?.ok) throw new Error(json?.error || "Community poll update failed");
  return json;
}

export default {
  fetchCommunityPolls,
  submitCommunityVote,
  submitCommunityPollAdminAction,
};
