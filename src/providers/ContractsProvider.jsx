/* @refresh reload */
// src/providers/ContractsProvider.jsx
import * as React from "react";
import { useWeb3 } from "../providers/Web3Provider";

import {
  getReadOnlyContract,
  getContract,
  // explicit contracts
  getReadOnlyMain,
  getMain,
  getReadOnlyMain2,
  getMain2,
  getVRFRO,
  getTokenRO,
  getToken,
  getDistributorRO,
  getDistributor,
  getReserveRO,
  getReserve,
  getTreasuryRO,
  getTreasury,
  getBuybackRO,
  getBuyback,
  getPolicyRO,
  getPolicy,
  getTokenRewardsRO,
  getTokenRewards,
  getCollectionRewardsRO,
  getCollectionRewards,
  getFactoryRO,
  getRouter,
  getRouterRO,
  getPairRO,
  getLMRawRO,
  getLMRaw,
  getUpkeepRO,
  getUpkeep,
  getReaderRO,
  getCollectionPublicRO,
  getCollectionVRFRO,
  getDripDistributorRO,
  getDripDistributor,
  getDripLMRO,
  getDripLM,
  getDripKeeperRO,
  getDripKeeper,
  // additional read-only readers (ensure exports exist in utils/contract.js)
  getBiggiMainReaderRO,
  getBiggiRewardsReaderRO,
  getBiggiTokenReaderRO,
  getBiggiTokenomicsReaderRO,
  // read-only provider helper
  getROProvider,
} from "../utils/contract";

const Ctx = React.createContext(null);
export const ContractsContext = Ctx;

/**
 * ContractsProvider:
 * provides access to contracts (read-only and write).
 *
 * Notes:
 * - if useWeb3 exposes `provider` (signer.provider), we use it for read-only too,
 *   so we hit the same RPC endpoint as the connected wallet (e.g., WalletConnect).
 * - if `provider` is missing, we fallback to internal `getROProvider()`.
 */
export function ContractsProvider({ children }) {
  const { signer, provider: web3Provider } = useWeb3(); // expect { signer, provider }; fallback to getROProvider if provider is missing

  // prefer web3Provider when available, otherwise internal RO provider; keep stable reference
  const effectiveROProvider = React.useCallback(() => {
    try {
      if (web3Provider) return web3Provider;
    } catch {}
    try {
      return getROProvider();
    } catch {
      return undefined;
    }
  }, [web3Provider]);

  // === sync resolver ===
  // Returns sync function: write contract if signer is present, otherwise read-only.
  const rwOrRo = (rwFactory, roFactory) => {
    return () => {
      try {
        if (signer) {
          try {
            return rwFactory();
          } catch {
            // fallback to read-only
          }
        }
      } catch {
        // ignore
      }
      // some roFactory may accept provider; pass it if possible
      try {
        return typeof roFactory === "function"
          ? roFactory(effectiveROProvider())
          : roFactory;
      } catch {
        return roFactory();
      }
    };
  };

  const value = React.useMemo(
    () => ({
      // backward compatibility
      mainRO: () => {
        try {
          return getReadOnlyContract(effectiveROProvider());
        } catch {
          return getReadOnlyContract();
        }
      },
      mainRW: rwOrRo(getContract, () =>
        getReadOnlyContract(effectiveROProvider()),
      ),

      liqRO: () => {
        try {
          return getLMRawRO(effectiveROProvider());
        } catch {
          return getLMRawRO();
        }
      },
      liqRW: rwOrRo(getLMRaw, () => getLMRawRO(effectiveROProvider())),

      // explicit contracts
      mainRead: () => {
        try {
          return getReadOnlyMain(effectiveROProvider());
        } catch {
          return getReadOnlyMain();
        }
      },
      mainWrite: rwOrRo(getMain, () => getReadOnlyMain(effectiveROProvider())),

      main2Read: () => {
        try {
          return getReadOnlyMain2(effectiveROProvider());
        } catch {
          return getReadOnlyMain2();
        }
      },
      main2Write: rwOrRo(getMain2, () =>
        getReadOnlyMain2(effectiveROProvider()),
      ),

      vrfRead: () => {
        try {
          return getVRFRO(effectiveROProvider());
        } catch {
          return getVRFRO();
        }
      },

      tokenRead: () => {
        try {
          return getTokenRO(effectiveROProvider());
        } catch {
          return getTokenRO();
        }
      },
      tokenWrite: rwOrRo(getToken, () => getTokenRO(effectiveROProvider())),

      distributorRead: () => {
        try {
          return getDistributorRO(effectiveROProvider());
        } catch {
          return getDistributorRO();
        }
      },
      distributorWrite: rwOrRo(getDistributor, () =>
        getDistributorRO(effectiveROProvider()),
      ),

      reserveRead: () => {
        try {
          return getReserveRO(effectiveROProvider());
        } catch {
          return getReserveRO();
        }
      },
      reserveWrite: rwOrRo(getReserve, () =>
        getReserveRO(effectiveROProvider()),
      ),

      treasuryRead: () => {
        try {
          return getTreasuryRO(effectiveROProvider());
        } catch {
          return getTreasuryRO();
        }
      },
      treasuryWrite: rwOrRo(getTreasury, () =>
        getTreasuryRO(effectiveROProvider()),
      ),

      buybackRead: () => {
        try {
          return getBuybackRO(effectiveROProvider());
        } catch {
          return getBuybackRO();
        }
      },
      buybackWrite: rwOrRo(getBuyback, () =>
        getBuybackRO(effectiveROProvider()),
      ),

      policyRead: () => {
        try {
          return getPolicyRO(effectiveROProvider());
        } catch {
          return getPolicyRO();
        }
      },
      policyWrite: rwOrRo(getPolicy, () => getPolicyRO(effectiveROProvider())),

      tokenRewardsRead: () => {
        try {
          return getTokenRewardsRO(effectiveROProvider());
        } catch {
          return getTokenRewardsRO();
        }
      },
      tokenRewardsWrite: rwOrRo(getTokenRewards, () =>
        getTokenRewardsRO(effectiveROProvider()),
      ),

      collectionRewardsRead: () => {
        try {
          return getCollectionRewardsRO(effectiveROProvider());
        } catch {
          return getCollectionRewardsRO();
        }
      },
      collectionRewardsWrite: rwOrRo(getCollectionRewards, () =>
        getCollectionRewardsRO(effectiveROProvider()),
      ),

      dripDistributorRead: () => {
        try {
          return getDripDistributorRO(effectiveROProvider());
        } catch {
          return getDripDistributorRO();
        }
      },
      dripDistributorWrite: rwOrRo(getDripDistributor, () =>
        getDripDistributorRO(effectiveROProvider()),
      ),

      dripLMRead: () => {
        try {
          return getDripLMRO(effectiveROProvider());
        } catch {
          return getDripLMRO();
        }
      },
      dripLMWrite: rwOrRo(getDripLM, () => getDripLMRO(effectiveROProvider())),

      dripKeeperRead: () => {
        try {
          return getDripKeeperRO(effectiveROProvider());
        } catch {
          return getDripKeeperRO();
        }
      },
      dripKeeperWrite: rwOrRo(getDripKeeper, () =>
        getDripKeeperRO(effectiveROProvider()),
      ),

      factoryRead: () => {
        try {
          return getFactoryRO(effectiveROProvider());
        } catch {
          return getFactoryRO();
        }
      },

      routerRead: () => {
        try {
          return getRouterRO(effectiveROProvider());
        } catch {
          return getRouterRO();
        }
      },
      routerWrite: rwOrRo(getRouter, () => getRouterRO(effectiveROProvider())),

      pairRead: () => {
        try {
          return getPairRO(effectiveROProvider());
        } catch {
          return getPairRO();
        }
      },

      lmRead: () => {
        try {
          return getLMRawRO(effectiveROProvider());
        } catch {
          return getLMRawRO();
        }
      },
      lmWrite: rwOrRo(getLMRaw, () => getLMRawRO(effectiveROProvider())),

      collectionPublicRead: () => {
        try {
          return getCollectionPublicRO(effectiveROProvider());
        } catch {
          return getCollectionPublicRO();
        }
      },
      collectionVrfRead: () => {
        try {
          return getCollectionVRFRO(effectiveROProvider());
        } catch {
          return getCollectionVRFRO();
        }
      },

      upkeepRead: () => {
        try {
          return getUpkeepRO(effectiveROProvider());
        } catch {
          return getUpkeepRO();
        }
      },
      upkeepWrite: rwOrRo(getUpkeep, () => getUpkeepRO(effectiveROProvider())),

      // generic reader (if only one reader contract is used)
      readerRead: () => {
        try {
          return getReaderRO(effectiveROProvider());
        } catch {
          return getReaderRO();
        }
      },

      // specialized FE readers (read-only)
      biggiMainReaderRead: () => {
        try {
          if (typeof getBiggiMainReaderRO === "function")
            return getBiggiMainReaderRO(effectiveROProvider());
        } catch {}
        return getReaderRO(effectiveROProvider());
      },

      biggiRewardsReaderRead: () => {
        try {
          if (typeof getBiggiRewardsReaderRO === "function")
            return getBiggiRewardsReaderRO(effectiveROProvider());
        } catch {}
        return getReaderRO(effectiveROProvider());
      },

      biggiTokenReaderRead: () => {
        try {
          if (typeof getBiggiTokenReaderRO === "function")
            return getBiggiTokenReaderRO(effectiveROProvider());
        } catch {}
        try {
          if (typeof getBiggiTokenomicsReaderRO === "function")
            return getBiggiTokenomicsReaderRO(effectiveROProvider());
        } catch {}
        return getReaderRO(effectiveROProvider());
      },

      biggiTokenomicsReaderRead: () => {
        try {
          if (typeof getBiggiTokenomicsReaderRO === "function")
            return getBiggiTokenomicsReaderRO(effectiveROProvider());
        } catch {}
        return getReaderRO(effectiveROProvider());
      },

      // expose effectiveROProvider in case someone needs the concrete provider
      _effectiveROProvider: effectiveROProvider,
    }),
    [signer, effectiveROProvider],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useContracts() {
  const context = React.useContext(Ctx);
  if (!context)
    throw new Error("useContracts must be used inside <ContractsProvider>");
  return context;
}
