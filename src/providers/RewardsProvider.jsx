import * as React from "react";
import { formatEther } from "ethers";
import { useContracts } from "./ContractsProvider";
import { getProviderForContract } from "../shared/utils/contract";
import { buildFeeOverrides } from "../shared/utils/txFees";

const Ctx = React.createContext(null);

export function REWARDSProvider({ children }) {
  const { chapterCollectionsRead, liqRO, liqRW } = useContracts();
  const [rewardPool, setRewardPool] = React.useState(null);
  const [myClaimable, setMyClaimable] = React.useState(null);
  const [mintVolumeMatic, setMintVolumeMatic] = React.useState(null);

  const refresh = React.useCallback(
    async (address = "") => {
      try {
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
        const volumeValues = await Promise.all(
          chapterCollectionsRead().map(async ({ contract }) => {
            for (const f of volumeFns) {
              if (typeof contract[f] !== "function") continue;
              try {
                return await contract[f]();
              } catch {}
            }
            return null;
          }),
        );
        const volWei = volumeValues.some((value) => value != null)
          ? volumeValues.reduce(
              (sum, value) => sum + BigInt(value?.toString?.() || "0"),
              0n,
            )
          : null;
        setMintVolumeMatic(
          volWei ? Number(formatEther(volWei)) : null,
        );

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
          setRewardPool(Number(formatEther(weeklyWei)));
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
        console.error("REWARDSProvider.refresh", e);
      }
    },
    [chapterCollectionsRead, liqRO],
  );

  const claim = React.useCallback(
    async (tokenIdsBN) => {
      const lr = await liqRW();
      const provider = getProviderForContract(lr);
      const feeOverrides = await buildFeeOverrides(provider);
      const tx = await lr.claim(tokenIdsBN, { ...feeOverrides });
      await tx.wait();
    },
    [liqRW],
  );

  return (
    <Ctx.Provider
      value={{ rewardPool, myClaimable, mintVolumeMatic, refresh, claim }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useREWARDS() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useREWARDS must be used inside <REWARDSProvider>");
  return v;
}
