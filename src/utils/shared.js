export const BACKGROUND_NAMES = ["ORANGE","BLACK","WHITE","BROWN","BLUE","GREEN","VIOLET","RED","PINK","RAINBOW"];
export const BACKGROUND_CODES = ["O","B","W","BR","BL","G","V","R","P","RB"];
export const BACKGROUND_BONUSES = [5,10,15,20,25,30,35,40,45,50];

// Smaller batches reduce RPC 400/429s on public endpoints
const LOGS_BATCH = 300;
const WALLET_CACHE_VERSION = "v1";
export const WALLET_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

export function walletCacheKey(addr) {
  return `biggi_wallet_${WALLET_CACHE_VERSION}_${String(addr || "").toLowerCase()}`;
}

export function loadWalletCache(addr, options = {}) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(walletCacheKey(addr));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const isExpired = parsed.ts && Date.now() - Number(parsed.ts) > WALLET_CACHE_TTL;
    if (isExpired && !options.allowExpired) return null;
    return Array.isArray(parsed.items) ? parsed.items : null;
  } catch {
    return null;
  }
}

export function saveWalletCache(addr, items) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const payload = JSON.stringify({ ts: Date.now(), items });
    window.localStorage.setItem(walletCacheKey(addr), payload);
  } catch {
    // ignore
  }
}

export async function getSafeDeployBlock(provider) {
  const DEPLOY_BLOCK = null;
  if (typeof DEPLOY_BLOCK === "number" && DEPLOY_BLOCK > 0) return DEPLOY_BLOCK;
  const latest = await provider.getBlockNumber();
  return Math.max(0, latest - 49_999);
}

export async function queryLogsBatched(contract, filter, fromBlock, toBlock, step = LOGS_BATCH) {
  const out = [];
  let start = fromBlock;
  let batch = step;
  while (start <= toBlock) {
    const end = Math.min(start + batch - 1, toBlock);
    try {
      const part = await contract.queryFilter(filter, start, end);
      if (part?.length) out.push(...part);
      start = end + 1;
      batch = step;
    } catch (err) {
      if (batch <= 1) throw err;
      batch = Math.max(1, Math.floor(batch / 2));
      continue;
    }
  }
  return out;
}

export const ERC20_MINI = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
];

export async function mapLimit(items, limit, mapper) {
  const ret = [];
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const cur = i++;
      ret[cur] = await mapper(items[cur], cur);
    }
  });
  await Promise.all(workers);
  return ret;
}
