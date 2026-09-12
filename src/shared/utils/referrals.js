export const normalizeReferralValue = (value) => String(value ?? "").trim();

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

export const buildModeratorReferralValue = (slotId, refCode = "") => {
  const slot = normalizeReferralValue(slotId);
  const code = normalizeReferralValue(refCode);
  if (!/^[0-9]$/.test(slot) || !code) return "";
  return `slot${slot}:${code}`;
};

export const buildModeratorReferralLink = (baseUrl, slotId, refCode = "") => {
  const base = normalizeReferralValue(baseUrl);
  const referral = buildModeratorReferralValue(slotId, refCode);
  if (!base || !referral) return "";
  try {
    const url = new URL(base);
    if (!["https:", "http:"].includes(url.protocol)) return "";
    url.searchParams.set("ref", referral);
    const hashQuery = url.hash.indexOf("?");
    if (hashQuery >= 0) {
      const hashParams = new URLSearchParams(url.hash.slice(hashQuery + 1));
      hashParams.delete("ref");
      url.hash =
        url.hash.slice(0, hashQuery) +
        (hashParams.size ? `?${hashParams}` : "");
    } else if (url.hash && !url.hash.startsWith("#/")) {
      const hashParams = new URLSearchParams(url.hash.slice(1));
      if (hashParams.has("ref")) {
        hashParams.delete("ref");
        url.hash = hashParams.size ? `#${hashParams}` : "";
      }
    }
    return url.toString();
  } catch {
    return "";
  }
};

export const extractMintedTicketIdFromReceipt = (
  receipt,
  contract,
  chapterId,
  buyer,
) => {
  const logs = Array.isArray(receipt?.logs) ? receipt.logs : [];
  const expectedBuyer = String(buyer || "").toLowerCase();
  let legacyTicketId = null;

  for (const log of logs) {
    try {
      const parsed = log?.fragment?.name
        ? log
        : contract?.interface?.parseLog?.(log);
      const eventName = parsed?.fragment?.name || parsed?.name || "";
      const args = parsed?.args;
      if (!args) continue;

      if (eventName === "ChapterMintRequested") {
        const eventChapter = Number(args.chapterId ?? args[0]);
        const eventBuyer = String(args.user ?? args[1] ?? "").toLowerCase();
        if (
          eventChapter === Number(chapterId) &&
          (!expectedBuyer || eventBuyer === expectedBuyer)
        ) {
          return args.ticketId ?? args[2] ?? null;
        }
      }

      if (eventName === "MintRequested") {
        const eventBuyer = String(args.user ?? args[0] ?? "").toLowerCase();
        if (!expectedBuyer || eventBuyer === expectedBuyer) {
          legacyTicketId = args.ticketId ?? args[1] ?? legacyTicketId;
        }
      }
    } catch {
      // A mint transaction also contains logs from routed payment contracts.
    }
  }

  return legacyTicketId;
};
