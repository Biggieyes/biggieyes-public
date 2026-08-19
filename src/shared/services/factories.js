// src/services/factories.js
// Small factory / re-export layer for existing service modules.
// Purpose: provide a single import point for service instances used by HOOKS and composed helpers.

import reserveService from "./reserveService";
import liquidityManagerService from "./liquidityManagerService";
import liquidityVaultService from "./liquidityVaultService";
import BUYBACKService from "./BUYBACKService";
import DRIPDistributorService from "./DRIPDistributorService";
import DRIPLMService from "./DRIPLMService";
import TokenREWARDSService from "./tokenREWARDSService";
import { getROProvider } from "@/shared/utils/contract";
import { ADDR } from "@/shared/utils/addresses.js";

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
export function createBUYBACKService(
  address = ADDR.BUYBACK_AGENT,
  provider = getROProvider(),
) {
  return new BUYBACKService(address, provider);
}

export function createDRIPDistributorService(
  address = ADDR.DRIP_DISTRIBUTOR,
  provider = getROProvider(),
) {
  return new DRIPDistributorService(address, provider);
}

export function createDRIPLMService(
  address = ADDR.DRIP_LM,
  provider = getROProvider(),
) {
  return new DRIPLMService(address, provider);
}

export function createTokenREWARDSService(
  address = ADDR.TOKEN_REWARDS,
  provider = getROProvider(),
) {
  return new TokenREWARDSService(address, provider);
}

// Backwards-compatible default getters (return simple modules / factories)
export function getBUYBACKService() {
  return createBUYBACKService();
}

export function getDRIPDistributorService() {
  return createDRIPDistributorService();
}

export function getDRIPLMService() {
  return createDRIPLMService();
}

export default {
  getReserveService,
  getLmService,
  getLiquidityVaultService,
  getBUYBACKService,
  getDRIPDistributorService,
  getDRIPLMService,
  createBUYBACKService,
  createDRIPDistributorService,
  createDRIPLMService,
  createTokenREWARDSService,
};




