import { ADDR } from "../utils/addresses";

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

function _dripAddresses() {
  return {
    dripDistributor: ADDR.DRIP_DISTRIBUTOR,
    dripLM: ADDR.DRIP_LM,
    biggiToken: ADDR.BIGGI_TOKEN || ADDR.BIGGI,
    router: ADDR.ROUTER,
    reserve: ADDR.RESERVE,
    treasury: ADDR.TREASURY,
  };
}

const DRIP_CHAIN_ADDRESSES = {
  80002: _dripAddresses(),
  137: _dripAddresses(),
  80001: _dripAddresses(),
};

function _buybackAddresses() {
  return {
    buybackAgent: ADDR.BUYBACK_AGENT,
    treasury: ADDR.TREASURY,
    biggiToken: ADDR.BIGGI_TOKEN || ADDR.BIGGI,
    router: ADDR.ROUTER,
    reserve: ADDR.RESERVE,
    dripDistributor: ADDR.DRIP_DISTRIBUTOR,
    tokenRewards: ADDR.TOKEN_REWARDS,
  };
}

const BUYBACK_CHAIN_ADDRESSES = {
  80002: _buybackAddresses(),
  137: _buybackAddresses(),
  80001: _buybackAddresses(),
};

export function getLiquidityAddresses(chainId) {
  const resolvedId = Number(chainId) || DEFAULT_CHAIN_ID;
  return CHAIN_ADDRESSES[resolvedId] || CHAIN_ADDRESSES[DEFAULT_CHAIN_ID];
}

export function getDripAddresses(chainId) {
  const resolvedId = Number(chainId) || DEFAULT_CHAIN_ID;
  return DRIP_CHAIN_ADDRESSES[resolvedId] || DRIP_CHAIN_ADDRESSES[DEFAULT_CHAIN_ID];
}

export function getBuybackAddresses(chainId) {
  const resolvedId = Number(chainId) || DEFAULT_CHAIN_ID;
  return BUYBACK_CHAIN_ADDRESSES[resolvedId] || BUYBACK_CHAIN_ADDRESSES[DEFAULT_CHAIN_ID];
}

function _tokenDexAddresses() {
  return {
    biggiToken: ADDR.BIGGI_TOKEN || ADDR.BIGGI,
    router: ADDR.ROUTER,
    factory: ADDR.FACTORY,
    weth: ADDR.WETH,
    pairAddress: ADDR.PAIR,
    lpPriceFeed: ADDR.BIGGI_PRICE_ORACLE,
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
  return TOKEN_DEX_CHAIN_ADDRESSES[resolvedId] || TOKEN_DEX_CHAIN_ADDRESSES[DEFAULT_CHAIN_ID];
}

export { CHAIN_ADDRESSES, DEFAULT_CHAIN_ID, DRIP_CHAIN_ADDRESSES, BUYBACK_CHAIN_ADDRESSES };
export default {
  CHAIN_ADDRESSES,
  DRIP_CHAIN_ADDRESSES,
  BUYBACK_CHAIN_ADDRESSES,
  TOKEN_DEX_CHAIN_ADDRESSES,
  getLiquidityAddresses,
  getDripAddresses,
  getBuybackAddresses,
  getTokenDexAddresses,
  DEFAULT_CHAIN_ID,
};
