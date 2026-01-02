// src/utils/addresses.js
// Centralní seznam adres kontraktů (obsahuje CamelCase a zpětně kompatibilní UPPER_SNAKE aliasy)

function _env(key) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) return import.meta.env[key];
  } catch (err) {
    console.debug("addresses._env import.meta lookup failed", key, err);
  }
  try {
    if (typeof process !== "undefined" && process.env) return process.env[key];
  } catch (err) {
    console.debug("addresses._env process.env lookup failed", key, err);
  }
  return undefined;
}

function _envAddr(key, fallback) {
  const keys = [
    key,
    `${key}_ADDRESS`,
    `${key}_ADDR`,
    `ADDR_${key}`,
  ].map((k) => `VITE_${k}`);
  for (const k of keys) {
    const v = _env(k);
    if (v && typeof v === "string" && v.trim()) return v.trim();
  }
  return fallback;
}

export const ADDR = {
  // Core
  MAIN:                "0x36D53EC08165cDdeD90f5148CA4cA52Fd65f200A",
  MAIN2:               "0x1703EA074C72F550ecacb955ECE1aac1c5100Be5",
  COLLECTION_VRF:      "0x36D53EC08165cDdeD90f5148CA4cA52Fd65f200A",
  COLLECTION_PUBLIC:   "0x1703EA074C72F550ecacb955ECE1aac1c5100Be5",
  VRF_ROUTER:          "0x404492EFc618954A8e66A9406755Dc62F1A1688b",
  DEPLOY_BLOCK:        27105502,

  BIGGI:               "0x45C6cC46dcBf54E97bDf89e9F739F29Ce4ED0dB7", // default, can be overridden via env
  BIGGI_TOKEN:         "0x45C6cC46dcBf54E97bDf89e9F739F29Ce4ED0dB7", // alias pro kompatibilitu

  DISTRIBUTOR:         "0xF29D65834e344bd229311686FccA4AAf451612e5",
  RESERVE:             "0xbF694e346D69acCEb578eA7C52642C521178e385",
  TREASURY:            "0xA1C5b749EDb98B5000DCaf30d4244AbB099BCEFb",
  BUYBACK_AGENT:       "0xB775Bd018053264033f9e8305DcF3BD7cf205F8e",
  POLICY:              "0xad677D4A01efBc143203412Ed96715e68141dC2f",

  COLLECTION_REWARDS:  "0xaD59A214a629daa6c0b91951A7967b233Ae7d8b8",
  TOKEN_REWARDS:       "0xdd77B1603e2DF405F93178A88995db12477d4ADa",
  DRIP_DISTRIBUTOR:    "0x2564b32eE85d2DFe3c234f79BBCaA94704e91FAE",
  DRIP_LM:             "0xf1A1f9C8fB64b8E14BbB35b6a41E139C7980db52",

  // Vault / keepers
  LIQUIDITY_VAULT:     "0x91359936f14337CED7c1Ce03C64A872378a9650e",
  KEEPER_PROXY:        "0x1Fc2D31C94137680847bFc90a7ef9588FCE402EB",
  KEEPER_ADDR:         "0xEC3CCe59fEDcF062E636dCDE112494044d77bB96", // Automation keeper (Amoy)
  DRIP_KEEPER_PROXY:   "0xc9C97929DA142DcA433C9A56A790291Aa4B90E6E",

  WETH:                "0x9984a18ee1f243992aF8d6a5E40c0373F88D99Ef",
  FACTORY:             "0x48D4D4BD5336Cc51209603AB4fA11A2dEF0Ba30F",
  ROUTER:              "0x52141c1c00AdD7dF95031c684186b10b5fDf448b",
  PAIR:                "0x59133d46598D178be59f2c6E1eFF222FFAf92229",
  BIGGI_PRICE_ORACLE:  "0x1F3169685f91975F7B51b473B2A36646c9A9fd55",

  LM:                  "0x1f60516dAb945297E7A12B729fE108e093b56e1e",
  UPKEEP_PROXY:        "0x3DEFF461B1ef4Df6df416017a3DA43b7E4f08ca8",
  COMMUNITY_CENTER:    "0x3462BC1561c3209848FC77e47cc1fF28d4a61b80",

  // NFT / rewards
  NFT_REWARDS:         "0x5952FB309cbC8919a554702A1Fb937F2e8943F39",

  // Misc config
  MASTER_CONFIG:       "0x0f79AbD6a643984c01ABAB7E0F53303c6cE79F76",
  COMPUTE:             "0x1Be0b75859747ABF7452b82359bFe68D77faD2F0",
  LIQUIDITY_SETUP:     "0x106F30e6733e20753e91E90c38827bf6165f9f7a",
  LIQUIDITY_AUTOMATION:"0x47CaDB979De8Beb8136bc2Be3Be7898F83941566",

  // --- NEW readers (replaces the old monolith readers) ---
  // použij tyto klíče v FE: ADDRESSES.NFT_REWARDS_READER, ADDRESSES.COLLECTION_REWARDS_READER, ...
  NFT_REWARDS_READER:      "0x4249E840c41F63AFA54AC80FDdBcE81fE3402336",
  BIGGI_REWARDS_READER:     "0x98b598aFCEaA6E7c9fdcC008C8c00A0F6dF2480B",
  COLLECTION_REWARDS_READER:"0x98b598aFCEaA6E7c9fdcC008C8c00A0F6dF2480B",
  TOKEN_REWARDS_READER:    "0xfEd7F92E3FBf57C0c96F4978ce38e9e2411a6dB0",
  RESERVE_READER:          "0x05398Da1D569245059d2fb9e04824BBFbF73a38E",
  BUYBACK_READER:          "0xd64A7250bAb788C1efea28c7a743BA1F2a2C978E",
  LM_READER:               "0x3208A5a466AE181f3581f6038d8612712751989E",
  // NOTE: MAIN_READER should point to the snapshot-capable CollectionReader (same as legacy READER).
  MAIN_READER:             "0x55DF51e99d093d91dB802FB6F8f95a22f63E9FD0",
  BIGGI_TOKENOMICS_READER: "0xf0A8631d7c8587454F73044C4D36D73649b623E8",

  // --- legacy generic reader slot (kept for backward compat) ---
  READER:                 "0x55DF51e99d093d91dB802FB6F8f95a22f63E9FD0",
};

/* ---------------- Backwards-compatible aliases (optional) ----------------
   Některé části repa mohou stále používat starší UPPER_SNAKE názvy.

   Exportuji je jako aliasy, aby existující kód dál fungoval.
*/
ADDR.CommunityCenter = ADDR.COMMUNITY_CENTER;
ADDR.COMMUNITY = ADDR.COMMUNITY_CENTER;
ADDR.LM_VAULT = ADDR.LIQUIDITY_VAULT;
ADDR.LM_VAULT = ADDR.LIQUIDITY_VAULT;
ADDR.NFT_REWARDS_CONTRACT = ADDR.NFT_REWARDS;
ADDR.MASTER = ADDR.MASTER_CONFIG;
ADDR.BiggiRewardsReader = ADDR.BIGGI_REWARDS_READER;

// Allow environment overrides (e.g., VITE_BIGGI=0x..., VITE_RESERVE=0x...)
const OVERRIDABLE_KEYS = [
  // core
  "MAIN", "MAIN2", "COLLECTION_VRF", "COLLECTION_PUBLIC", "VRF_ROUTER",

  // token & modules
  "BIGGI", "BIGGI_TOKEN", "DISTRIBUTOR", "RESERVE", "TREASURY", "BUYBACK_AGENT", "POLICY", "COMMUNITY_CENTER",

  // rewards / drip
  "COLLECTION_REWARDS", "TOKEN_REWARDS", "NFT_REWARDS", "DRIP_DISTRIBUTOR", "DRIP_LM",

  // dex / pricing
  "FACTORY", "ROUTER", "PAIR", "WETH", "BIGGI_PRICE_ORACLE",

  // LM / keepers
  "LM", "LIQUIDITY_VAULT", "UPKEEP_PROXY", "KEEPER_PROXY", "KEEPER_ADDR", "DRIP_KEEPER_PROXY",

  // readers
  "READER",
  "MAIN_READER",
  "BIGGI_REWARDS_READER",
  "COLLECTION_REWARDS_READER",
  "TOKEN_REWARDS_READER",
  "NFT_REWARDS_READER",
  "RESERVE_READER",
  "BUYBACK_READER",
  "LM_READER",
  "BIGGI_TOKENOMICS_READER",

  // misc config
  "MASTER_CONFIG",
  "COMPUTE",
  "LIQUIDITY_SETUP",
  "LIQUIDITY_AUTOMATION",
];

for (const key of OVERRIDABLE_KEYS) {
  const override = _envAddr(key, null);
  if (override) ADDR[key] = override;
}

// Legacy env support: VITE_ADDR_BiggiRewardsReader -> map into the canonical reader slots.
const legacyBiggiRewardsReader = _envAddr("BiggiRewardsReader", null);
if (legacyBiggiRewardsReader) {
  ADDR.BIGGI_REWARDS_READER = legacyBiggiRewardsReader;
  ADDR.COLLECTION_REWARDS_READER = legacyBiggiRewardsReader;
  ADDR.BiggiRewardsReader = legacyBiggiRewardsReader;
}

// Export nový objekt ADDRESSES (použij ho v nové části FE: src/utils/contracts.js očekává ADDRESSES)
export const ADDRESSES = {
  NFT_REWARDS_READER: ADDR.NFT_REWARDS_READER,
  COLLECTION_REWARDS_READER: ADDR.COLLECTION_REWARDS_READER,
  BIGGI_REWARDS_READER: ADDR.BIGGI_REWARDS_READER,
  TOKEN_REWARDS_READER: ADDR.TOKEN_REWARDS_READER,
  RESERVE_READER: ADDR.RESERVE_READER,
  BUYBACK_READER: ADDR.BUYBACK_READER,
  LM_READER: ADDR.LM_READER,
  MAIN_READER: ADDR.MAIN_READER,

  // keep some high-level legacy addresses too
  MAIN: ADDR.MAIN,
  MAIN2: ADDR.MAIN2,
  COLLECTION_VRF: ADDR.COLLECTION_VRF,
  COLLECTION_PUBLIC: ADDR.COLLECTION_PUBLIC,
  VRF_ROUTER: ADDR.VRF_ROUTER,
  BIGGI: ADDR.BIGGI,
  BIGGI_TOKEN: ADDR.BIGGI_TOKEN,
  DISTRIBUTOR: ADDR.DISTRIBUTOR,
  RESERVE: ADDR.RESERVE,
  TREASURY: ADDR.TREASURY,
  BUYBACK_AGENT: ADDR.BUYBACK_AGENT,
  POLICY: ADDR.POLICY,
  COMMUNITY_CENTER: ADDR.COMMUNITY_CENTER,
  DRIP_DISTRIBUTOR: ADDR.DRIP_DISTRIBUTOR,
  DRIP_LM: ADDR.DRIP_LM,
  LIQUIDITY_VAULT: ADDR.LIQUIDITY_VAULT,
  LM_VAULT: ADDR.LIQUIDITY_VAULT,
  NFT_REWARDS: ADDR.NFT_REWARDS,
  MASTER_CONFIG: ADDR.MASTER_CONFIG,
  COMPUTE: ADDR.COMPUTE,
  LIQUIDITY_SETUP: ADDR.LIQUIDITY_SETUP,
  LIQUIDITY_AUTOMATION: ADDR.LIQUIDITY_AUTOMATION,
  KEEPER_PROXY: ADDR.KEEPER_PROXY,
  KEEPER_ADDR: ADDR.KEEPER_ADDR,
  DRIP_KEEPER_PROXY: ADDR.DRIP_KEEPER_PROXY,
  UPKEEP_PROXY: ADDR.UPKEEP_PROXY,
  BIGGI_TOKENOMICS_READER: ADDR.BIGGI_TOKENOMICS_READER,
  READER: ADDR.READER,
  BIGGI_PRICE_ORACLE: ADDR.BIGGI_PRICE_ORACLE,
};

// back-compat: if some code imports ADDR.BiggiMainReader / BiggiRewardsReader etc. — ty jsme odstranili.
// Pokud máš někde v kódu reference na ADDR.BiggiMainReader / ADDR.BiggiRewardsReader nebo
// ADDR.BiggiTokenomicsReader, nahraď je prosím těmito novými klíči:
//   - BiggiRewardsReader (monolit)  -> rozděleno na COLLECTION_REWARDS_READER, NFT_REWARDS_READER, TOKEN_REWARDS_READER, RESERVE_READER
//   - BiggiMainReader              -> MAIN_READER
//   - BiggiTokenomicsReader        -> nahrazeno RESERVE_READER / LM_READER / BUYBACK_READER podle toho co voláš
