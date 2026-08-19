export const normalizeReferralValue = (value) => String(value || "").trim();

export const getMergedUrlSearchParams = (input) => {
  const url =
    input instanceof URL ? new URL(input.toString()) : new URL(String(input));
  const params = new URLSearchParams(url.search);
  const rawHash = url.hash ? String(url.hash) : "";
  const hash = rawHash.replace(/^#/, "");

  if (hash.includes("?")) {
    const query = hash.split("?")[1];
    if (query) {
      for (const [key, value] of new URLSearchParams(query)) {
        params.set(key, value);
      }
    }
  } else if (hash && !hash.startsWith("/")) {
    for (const [key, value] of new URLSearchParams(hash)) {
      params.set(key, value);
    }
  }

  return params;
};

export const extractReferralParam = (input) =>
  normalizeReferralValue(getMergedUrlSearchParams(input).get("ref"));

export const buildModeratorReferralLink = (baseUrl, slotId, refCode = "") => {
  const base = normalizeReferralValue(baseUrl);
  const slot = normalizeReferralValue(slotId);
  const code = normalizeReferralValue(refCode) || "code";
  if (!base || !slot || slot === "--") return "";
  return `${base}?ref=slot${slot}:${code}`;
};
