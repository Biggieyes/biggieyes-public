/* @refresh reload */
// src/providers/ContractsProvider.jsx
import * as React from "react";
import { useWeb3 } from "../providers/Web3Provider";

import {
  getReadOnlyContract,
  // explicit contracts
  getReadOnlyMain,
  getReadOnlyMain2,
  getReadOnlyChapterMain,
  getChapterMain,
  getReadOnlyChapterMain2,
  getChapterMain2,
  getReadOnlyTicketHub,
  getTicketHub,
  getVRFRO,
  getTokenRO,
  getToken,
  getDistributorRO,
  getDistributor,
  getReserveRO,
  getReserve,
  getTreasuryRO,
  getTreasury,
  getBUYBACKRO,
  getBUYBACK,
  getPOLICYRO,
  getPOLICY,
  getTokenREWARDSRO,
  getTokenREWARDS,
  getCOLLECTIONREWARDSRO,
  getCOLLECTIONREWARDS,
  getFactoryRO,
  getRouter,
  getRouterRO,
  getPairRO,
  getLMRawRO,
  getLMRaw,
  getUpkeepRO,
  getUpkeep,
  getReaderRO,
  getCOLLECTIONPublicRO,
  getCOLLECTIONVRFRO,
  getDRIPDistributorRO,
  getDRIPDistributor,
  getDRIPLMRO,
  getDRIPLM,
  getDRIPKeeperRO,
  getDRIPKeeper,
  // additional read-only readers (ensure exports exist in utils/contract.js)
  getBiggiMainReaderRO,
  getBiggiREWARDSReaderRO,
  getBiggiTokenReaderRO,
  getBiggiTokenomicsReaderRO,
  // read-only provider helper
  getROProvider,
} from "@/shared/utils/contract";
import { CORE_CHAPTERS } from "@/shared/utils/addresses.js";

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

  // prefer internal RPC for reads to avoid wallet RPC pruning; opt-in to wallet reads via env
  const preferWalletReads = React.useMemo(() => {
    try {
      if (typeof import.meta !== "undefined" && import.meta.env) {
        return import.meta.env.VITE_USE_WALLET_FOR_READS === "true";
      }
    } catch {
      // ignore env lookup errors
    }
    return false;
  }, []);

  const effectiveROProvider = React.useCallback(() => {
    try {
      if (preferWalletReads && web3Provider) return web3Provider;
    } catch {}
    try {
      return getROProvider();
    } catch {
      return web3Provider || undefined;
    }
  }, [preferWalletReads, web3Provider]);

  // === sync resolver ===
  // Returns sync function: write contract if signer is present, otherwise read-only.
  const rwOrRo = (rwFactory, roFactory) => {
    return async () => {
      try {
        if (signer) {
          try {
            return await rwFactory();
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
      mainRW: (chapterId) =>
        rwOrRo(
          () => getChapterMain(chapterId, signer),
          () => getReadOnlyChapterMain(chapterId, effectiveROProvider()),
        )(),

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
      mainWrite: (chapterId) =>
        rwOrRo(
          () => getChapterMain(chapterId, signer),
          () => getReadOnlyChapterMain(chapterId, effectiveROProvider()),
        )(),

      main2Read: () => {
        try {
          return getReadOnlyMain2(effectiveROProvider());
        } catch {
          return getReadOnlyMain2();
        }
      },
      main2Write: (chapterId) =>
        rwOrRo(
          () => getChapterMain2(chapterId, signer),
          () => getReadOnlyChapterMain2(chapterId, effectiveROProvider()),
        )(),

      chapterMainRead: (chapterId) =>
        getReadOnlyChapterMain(chapterId, effectiveROProvider()),
      chapterMainWrite: (chapterId) =>
        rwOrRo(
          () => getChapterMain(chapterId, signer),
          () => getReadOnlyChapterMain(chapterId, effectiveROProvider()),
        )(),
      chapterMain2Read: (chapterId) =>
        getReadOnlyChapterMain2(chapterId, effectiveROProvider()),
      chapterMain2Write: (chapterId) =>
        rwOrRo(
          () => getChapterMain2(chapterId, signer),
          () => getReadOnlyChapterMain2(chapterId, effectiveROProvider()),
        )(),
      chapterCollectionsRead: () =>
        CORE_CHAPTERS.flatMap((chapter) => [
          {
            chapterId: chapter.chapterId,
            collectionType: "vrf",
            address: chapter.main,
            contract: getReadOnlyChapterMain(
              chapter.chapterId,
              effectiveROProvider(),
            ),
          },
          {
            chapterId: chapter.chapterId,
            collectionType: "public",
            address: chapter.main2,
            contract: getReadOnlyChapterMain2(
              chapter.chapterId,
              effectiveROProvider(),
            ),
          },
        ]),
      collectionReadByAddress: (address) => {
        const target = String(address || "").toLowerCase();
        const chapter = CORE_CHAPTERS.find(
          (item) =>
            String(item.main).toLowerCase() === target ||
            String(item.main2).toLowerCase() === target,
        );
        if (!chapter) return null;
        return String(chapter.main).toLowerCase() === target
          ? getReadOnlyChapterMain(chapter.chapterId, effectiveROProvider())
          : getReadOnlyChapterMain2(chapter.chapterId, effectiveROProvider());
      },
      ticketHubRead: () => getReadOnlyTicketHub(effectiveROProvider()),
      ticketHubWrite: rwOrRo(getTicketHub, () =>
        getReadOnlyTicketHub(effectiveROProvider()),
      ),

      VRFRead: () => {
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

      BUYBACKRead: () => {
        try {
          return getBUYBACKRO(effectiveROProvider());
        } catch {
          return getBUYBACKRO();
        }
      },
      BUYBACKWrite: rwOrRo(getBUYBACK, () =>
        getBUYBACKRO(effectiveROProvider()),
      ),

      POLICYRead: () => {
        try {
          return getPOLICYRO(effectiveROProvider());
        } catch {
          return getPOLICYRO();
        }
      },
      POLICYWrite: rwOrRo(getPOLICY, () => getPOLICYRO(effectiveROProvider())),

      tokenREWARDSRead: () => {
        try {
          return getTokenREWARDSRO(effectiveROProvider());
        } catch {
          return getTokenREWARDSRO();
        }
      },
      tokenREWARDSWrite: rwOrRo(getTokenREWARDS, () =>
        getTokenREWARDSRO(effectiveROProvider()),
      ),

      COLLECTIONREWARDSRead: () => {
        try {
          return getCOLLECTIONREWARDSRO(effectiveROProvider());
        } catch {
          return getCOLLECTIONREWARDSRO();
        }
      },
      COLLECTIONREWARDSWrite: rwOrRo(getCOLLECTIONREWARDS, () =>
        getCOLLECTIONREWARDSRO(effectiveROProvider()),
      ),

      DRIPDistributorRead: () => {
        try {
          return getDRIPDistributorRO(effectiveROProvider());
        } catch {
          return getDRIPDistributorRO();
        }
      },
      DRIPDistributorWrite: rwOrRo(getDRIPDistributor, () =>
        getDRIPDistributorRO(effectiveROProvider()),
      ),

      DRIPLMRead: () => {
        try {
          return getDRIPLMRO(effectiveROProvider());
        } catch {
          return getDRIPLMRO();
        }
      },
      DRIPLMWrite: rwOrRo(getDRIPLM, () => getDRIPLMRO(effectiveROProvider())),

      DRIPKeeperRead: () => {
        try {
          return getDRIPKeeperRO(effectiveROProvider());
        } catch {
          return getDRIPKeeperRO();
        }
      },
      DRIPKeeperWrite: rwOrRo(getDRIPKeeper, () =>
        getDRIPKeeperRO(effectiveROProvider()),
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

      COLLECTIONPublicRead: () => {
        try {
          return getCOLLECTIONPublicRO(effectiveROProvider());
        } catch {
          return getCOLLECTIONPublicRO();
        }
      },
      COLLECTIONVRFRead: () => {
        try {
          return getCOLLECTIONVRFRO(effectiveROProvider());
        } catch {
          return getCOLLECTIONVRFRO();
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

      biggiREWARDSReaderRead: () => {
        try {
          if (typeof getBiggiREWARDSReaderRO === "function")
            return getBiggiREWARDSReaderRO(effectiveROProvider());
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

