// Centralized addresses derived from src/utils/addresses.js
import { ADDR as CANON_ADDR } from "../utils/addresses.js";

const ADDR = {
  ...CANON_ADDR,
  // legacy aliases used by older code paths
  COLLECTION: CANON_ADDR.MAIN,
  COLLECTION2: CANON_ADDR.MAIN2,
  TOKENOMIK_READER: CANON_ADDR.TOKENOMIK_READER || CANON_ADDR.BIGGI_TOKENOMICS_READER,
  m1: CANON_ADDR.MAIN,
  m2: CANON_ADDR.MAIN2,
  DRIPd: CANON_ADDR.DRIP_DISTRIBUTOR,
  DRIPLm: CANON_ADDR.DRIP_LM,
  reserve: CANON_ADDR.RESERVE,
  BiggiMain: CANON_ADDR.MAIN,
  BiggiMain2: CANON_ADDR.MAIN2,
  BiggiReserve: CANON_ADDR.RESERVE,
  DRIPDistributor: CANON_ADDR.DRIP_DISTRIBUTOR,
  DRIPLM: CANON_ADDR.DRIP_LM,
  LiquidityKeeper: CANON_ADDR.KEEPER_PROXY || "",
  MULTI_COLLECTION_DISTRIBUTOR: CANON_ADDR.MULTI_COLLECTION_DISTRIBUTOR || "",
};

const DEFAULT_CHAIN_ID = 80002;

function _baseAddresses() {
  return {
    reserve: ADDR.RESERVE,
    liquidityManager: ADDR.LM,
    liquidityVault: ADDR.LIQUIDITY_VAULT,
  };
}

const CHAIN_ADDRESSES = {
  80002: _baseAddresses(),
  137: _baseAddresses(),
  80001: _baseAddresses(),
};

function _DRIPAddresses() {
  return {
    DRIPDistributor: ADDR.DRIP_DISTRIBUTOR,
    DRIPLM: ADDR.DRIP_LM,
    biggiToken: ADDR.BIGGI_TOKEN || ADDR.BIGGI,
    router: ADDR.ROUTER,
    reserve: ADDR.RESERVE,
    treasury: ADDR.TREASURY,
  };
}

const DRIP_CHAIN_ADDRESSES = {
  80002: _DRIPAddresses(),
  137: _DRIPAddresses(),
  80001: _DRIPAddresses(),
};

function _BUYBACKAddresses() {
  return {
    BUYBACKAgent: ADDR.BUYBACK_AGENT,
    treasury: ADDR.TREASURY,
    biggiToken: ADDR.BIGGI_TOKEN || ADDR.BIGGI,
    router: ADDR.ROUTER,
    reserve: ADDR.RESERVE,
    DRIPDistributor: ADDR.DRIP_DISTRIBUTOR,
    tokenREWARDS: ADDR.TOKEN_REWARDS,
  };
}

const BUYBACK_CHAIN_ADDRESSES = {
  80002: _BUYBACKAddresses(),
  137: _BUYBACKAddresses(),
  80001: _BUYBACKAddresses(),
};

export function getLiquidityAddresses(chainId) {
  const resolvedId = Number(chainId) || DEFAULT_CHAIN_ID;
  return CHAIN_ADDRESSES[resolvedId] || CHAIN_ADDRESSES[DEFAULT_CHAIN_ID];
}

export function getDRIPAddresses(chainId) {
  const resolvedId = Number(chainId) || DEFAULT_CHAIN_ID;
  return (
    DRIP_CHAIN_ADDRESSES[resolvedId] || DRIP_CHAIN_ADDRESSES[DEFAULT_CHAIN_ID]
  );
}

export function getBUYBACKAddresses(chainId) {
  const resolvedId = Number(chainId) || DEFAULT_CHAIN_ID;
  return (
    BUYBACK_CHAIN_ADDRESSES[resolvedId] ||
    BUYBACK_CHAIN_ADDRESSES[DEFAULT_CHAIN_ID]
  );
}

function _tokenDexAddresses() {
  return {
    biggiToken: ADDR.BIGGI_TOKEN || ADDR.BIGGI,
    router: ADDR.ROUTER,
    factory: ADDR.FACTORY,
    weth: ADDR.WETH,
    pairAddress: ADDR.PAIR,
    lpPriceFeed: ADDR.LP_PRICE_FEED,
    reserve: ADDR.RESERVE,
    liquidityVault: ADDR.LIQUIDITY_VAULT,
    treasury: ADDR.TREASURY,
  };
}

const TOKEN_DEX_CHAIN_ADDRESSES = {
  80002: _tokenDexAddresses(),
  137: _tokenDexAddresses(),
  80001: _tokenDexAddresses(),
};

export function getTokenDexAddresses(chainId) {
  const resolvedId = Number(chainId) || DEFAULT_CHAIN_ID;
  return (
    TOKEN_DEX_CHAIN_ADDRESSES[resolvedId] ||
    TOKEN_DEX_CHAIN_ADDRESSES[DEFAULT_CHAIN_ID]
  );
}

export {
  CHAIN_ADDRESSES,
  DEFAULT_CHAIN_ID,
  DRIP_CHAIN_ADDRESSES,
  BUYBACK_CHAIN_ADDRESSES,
  ADDR,
};
export default {
  CHAIN_ADDRESSES,
  DRIP_CHAIN_ADDRESSES,
  BUYBACK_CHAIN_ADDRESSES,
  TOKEN_DEX_CHAIN_ADDRESSES,
  getLiquidityAddresses,
  getDRIPAddresses,
  getBUYBACKAddresses,
  getTokenDexAddresses,
  DEFAULT_CHAIN_ID,
  ADDR,
};
