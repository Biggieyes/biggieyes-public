// src/services/factories.js
// Small factory / re-export layer for existing service modules.
// Purpose: provide a single import point for service instances used by hooks and composed helpers.

import reserveService from "./reserveService";
import liquidityManagerService from "./liquidityManagerService";
import liquidityVaultService from "./liquidityVaultService";
import BuybackService from "./buybackService";
import DripDistributorService from "./dripDistributorService";
import DripLMService from "./dripLMService";
import TokenRewardsService from "./tokenRewardsService";
import { getROProvider } from "../utils/contract";
import { ADDR } from "../utils/addresses";

// Simple getters for functional services (they use internal RO provider by default)
export function getReserveService() {
  return reserveService;
}

export function getLmService() {
  return liquidityManagerService;
}

export function getLiquidityVaultService() {
  return liquidityVaultService;
}

// Class-based services: provide factory that instantiates with a read-only provider
export function createBuybackService(
  address = ADDR.BUYBACK_AGENT,
  provider = getROProvider(),
) {
  return new BuybackService(address, provider);
}

export function createDripDistributorService(
  address = ADDR.DRIP_DISTRIBUTOR,
  provider = getROProvider(),
) {
  return new DripDistributorService(address, provider);
}

export function createDripLMService(
  address = ADDR.DRIP_LM,
  provider = getROProvider(),
) {
  return new DripLMService(address, provider);
}

export function createTokenRewardsService(
  address = ADDR.TOKEN_REWARDS,
  provider = getROProvider(),
) {
  return new TokenRewardsService(address, provider);
}

// Backwards-compatible default getters (return simple modules / factories)
export function getBuybackService() {
  return createBuybackService();
}

export function getDripDistributorService() {
  return createDripDistributorService();
}

export function getDripLMService() {
  return createDripLMService();
}

export default {
  getReserveService,
  getLmService,
  getLiquidityVaultService,
  getBuybackService,
  getDripDistributorService,
  getDripLMService,
  createBuybackService,
  createDripDistributorService,
  createDripLMService,
  createTokenRewardsService,
};

