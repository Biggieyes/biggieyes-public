import * as React from "react";
import { ethers } from "ethers";
import { useContracts } from "./ContractsProvider";

const Ctx = React.createContext(null);

export function RewardsProvider({ children }) {
  const { mainRO, liqRO, liqRW } = useContracts();
  const [rewardPool, setRewardPool] = React.useState(null);
  const [myClaimable, setMyClaimable] = React.useState(null);
  const [mintVolumeMatic, setMintVolumeMatic] = React.useState(null);

  const refresh = React.useCallback(
    async (address = "") => {
      try {
        const c = await mainRO();

        // volume
        const volumeFns = [
          "totalMintVolume",
          "mintVolume",
          "getMintVolume",
          "totalRevenue",
          "totalRevenueMatic",
          "accMintValue",
          "mintedValue",
        ];
        let volWei = null;
        for (const f of volumeFns) {
          if (typeof c[f] === "function") {
            try {
              volWei = await c[f]();
              break;
            } catch {}
          }
        }
        setMintVolumeMatic(volWei ? Number(ethers.utils.formatEther(volWei)) : null);

        // weekly pool
        let weeklyWei = null;
        try {
          const lr = await liqRO();
          const weeklyFns = [
            "weeklyPool",
            "currentWeekPool",
            "getWeeklyPool",
            "weekPool",
            "poolForCurrentWeek",
            "rewardPool",
            "currentRewardPool",
          ];
          for (const f of weeklyFns) {
            if (typeof lr[f] === "function") {
              try {
                weeklyWei = await lr[f]();
                break;
              } catch {}
            }
          }
        } catch {}
        if (weeklyWei != null) {
          setRewardPool(Number(ethers.utils.formatEther(weeklyWei)));
        } else if (volWei) {
          setRewardPool(Number(ethers.utils.formatEther(volWei)) * 0.22);
        } else {
          setRewardPool(0);
        }

        // claimable preview (if we have an address)
        if (address) {
          try {
            const lr = await liqRO();
            // simple fallback: if we don't have token list yet, leave 0
            setMyClaimable(0);
            // detailed calc will be added later after InventoryProvider integration
          } catch {
            setMyClaimable(0);
          }
        }
      } catch (e) {
        console.error("RewardsProvider.refresh", e);
      }
    },
    [mainRO, liqRO]
  );

  const claim = React.useCallback(
    async (tokenIdsBN) => {
      const lr = await liqRW();
      const tx = await lr.claim(tokenIdsBN);
      await tx.wait();
    },
    [liqRW]
  );

  return (
    <Ctx.Provider value={{ rewardPool, myClaimable, mintVolumeMatic, refresh, claim }}>
      {children}
    </Ctx.Provider>
  );
}

export function useRewards() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useRewards must be used inside <RewardsProvider>");
  return v;
}
