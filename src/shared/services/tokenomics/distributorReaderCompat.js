import { ZeroAddress } from "ethers";

function _tupleValue(value, key, index, fallback = null) {
  if (value == null) return fallback;
  if (key && value[key] != null) return value[key];
  if (Array.isArray(value) && value[index] != null) return value[index];
  return fallback;
}

function _normalizeLegacySnapshot(raw) {
  const snap = raw?.s ?? raw?.[0] ?? raw;
  if (!snap) return null;
  return {
    collectionRewards: _tupleValue(snap, "collectionRewards", 0),
    reserve: _tupleValue(snap, "reserve", 1),
    buybackAgent: _tupleValue(snap, "buybackAgent", 2),
    treasury: _tupleValue(snap, "treasury", 3),
    communityCenter: _tupleValue(snap, "communityCenter", 4),
    totalPending: _tupleValue(snap, "totalPending", 5, 0n),
    totalReceived: _tupleValue(snap, "totalReceived", 6, 0n),
    registry: _tupleValue(snap, "registry", 7, null),
  };
}

function _normalizeRecipients(raw) {
  if (!raw) return null;
  return {
    collectionRewards: _tupleValue(raw, "collectionRewards_", 0),
    reserve: _tupleValue(raw, "reserve_", 1),
    buybackAgent: _tupleValue(raw, "buybackAgent_", 2),
    treasury: _tupleValue(raw, "treasury_", 3),
    communityCenter: _tupleValue(raw, "communityCenter_", 4),
    registry: _tupleValue(raw, "registry_", 5),
  };
}

function _normalizeFullSnapshot(raw) {
  if (!raw) return null;
  return {
    totalReceived: _tupleValue(raw, "totalReceived_", 0, 0n),
    totalPending: _tupleValue(raw, "totalPending_", 1, 0n),
    pendingForRecipient: _tupleValue(raw, "pendingForRecipient", 2, 0n),
    sourceWhitelisted: _tupleValue(raw, "sourceWhitelisted", 3, false),
    sourceReceived: _tupleValue(raw, "sourceReceived", 4, 0n),
    sourceChapterId: _tupleValue(raw, "sourceChapterId", 5, 0n),
    sourceChapterNumber: _tupleValue(raw, "sourceChapterNumber", 6, 0n),
    sourceSeriesId: _tupleValue(raw, "sourceSeriesId", 7, 0n),
    chapterReceived: _tupleValue(raw, "chapterReceived", 8, 0n),
    seriesReceived: _tupleValue(raw, "seriesReceived", 9, 0n),
    collectionRewards: _tupleValue(raw, "collectionRewards_", 10),
    reserve: _tupleValue(raw, "reserve_", 11),
    buybackAgent: _tupleValue(raw, "buybackAgent_", 12),
    treasury: _tupleValue(raw, "treasury_", 13),
    communityCenter: _tupleValue(raw, "communityCenter_", 14),
    registry: _tupleValue(raw, "registry_", 15),
  };
}

function _normalizeSourceSnapshot(raw) {
  if (!raw) return null;
  return {
    whitelisted: _tupleValue(raw, "whitelisted", 0, false),
    totalForSource: _tupleValue(raw, "totalForSource", 1, 0n),
    chapterId: _tupleValue(raw, "chapterId", 2, 0n),
    chapterNumber: _tupleValue(raw, "chapterNumber", 3, 0n),
    seriesId: _tupleValue(raw, "seriesId", 4, 0n),
    totalForChapter: _tupleValue(raw, "totalForChapter", 5, 0n),
    totalForSeries: _tupleValue(raw, "totalForSeries", 6, 0n),
  };
}

export async function getDistributorRecipients(reader) {
  if (!reader) return null;
  if (typeof reader.recipients === "function") {
    return _normalizeRecipients(await reader.recipients());
  }
  const legacy = _normalizeLegacySnapshot(
    typeof reader.globalSnapshot === "function"
      ? await reader.globalSnapshot()
      : null,
  );
  return legacy
    ? {
        collectionRewards: legacy.collectionRewards,
        reserve: legacy.reserve,
        buybackAgent: legacy.buybackAgent,
        treasury: legacy.treasury,
        communityCenter: legacy.communityCenter,
        registry: legacy.registry,
      }
    : null;
}

export async function getDistributorGlobalSnapshot(
  reader,
  { source = ZeroAddress, pendingRecipient = ZeroAddress } = {},
) {
  if (!reader) return null;
  if (typeof reader.globalSnapshot === "function") {
    return _normalizeLegacySnapshot(await reader.globalSnapshot());
  }
  if (typeof reader.fullSnapshot === "function") {
    return _normalizeFullSnapshot(
      await reader.fullSnapshot(source || ZeroAddress, pendingRecipient || ZeroAddress),
    );
  }
  const recipients = await getDistributorRecipients(reader);
  if (!recipients) return null;
  return {
    ...recipients,
    totalPending: 0n,
    totalReceived: 0n,
    pendingForRecipient: 0n,
  };
}

export async function getDistributorPendingOf(reader, addresses = []) {
  if (!reader || !Array.isArray(addresses) || !addresses.length) return [];
  if (typeof reader.pendingOf === "function") {
    const out = await reader.pendingOf(addresses);
    return Array.from(out || []);
  }
  if (typeof reader.pendingSnapshot === "function") {
    const rows = await Promise.all(
      addresses.map(async (address) => {
        const raw = await reader.pendingSnapshot(address);
        return _tupleValue(raw, "recipientPending", 0, 0n);
      }),
    );
    return rows;
  }
  return [];
}

export async function getDistributorPendingCommunity(reader) {
  if (!reader) return null;
  if (typeof reader.pendingCommunity === "function") {
    return await reader.pendingCommunity();
  }
  if (typeof reader.pendingSnapshot === "function") {
    const recipients = await getDistributorRecipients(reader);
    const community = recipients?.communityCenter || ZeroAddress;
    if (!community || community === ZeroAddress) return null;
    const raw = await reader.pendingSnapshot(community);
    return _tupleValue(raw, "recipientPending", 0, null);
  }
  return null;
}

export async function getDistributorReceivedOfCollections(reader, addresses = []) {
  if (!reader || !Array.isArray(addresses) || !addresses.length) return [];
  if (typeof reader.receivedOfCollections === "function") {
    const out = await reader.receivedOfCollections(addresses);
    return Array.from(out || []);
  }
  if (typeof reader.sourceSnapshot === "function") {
    const rows = await Promise.all(
      addresses.map(async (address) => {
        const snap = _normalizeSourceSnapshot(await reader.sourceSnapshot(address));
        return snap?.totalForSource ?? 0n;
      }),
    );
    return rows;
  }
  return [];
}

export async function getDistributorWhitelisted(reader, addresses = []) {
  if (!reader || !Array.isArray(addresses) || !addresses.length) return [];
  if (typeof reader.whitelisted === "function") {
    const out = await reader.whitelisted(addresses);
    return Array.from(out || []);
  }
  if (typeof reader.sourceSnapshot === "function") {
    const rows = await Promise.all(
      addresses.map(async (address) => {
        const snap = _normalizeSourceSnapshot(await reader.sourceSnapshot(address));
        return Boolean(snap?.whitelisted);
      }),
    );
    return rows;
  }
  return [];
}
