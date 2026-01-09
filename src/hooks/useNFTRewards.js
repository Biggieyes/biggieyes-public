// src/HOOKS/useNFTREWARDS.js
import * as React from "react";
import { Contract } from "ethers";
import {
  BiggiMain as BiggiMainABI,
  BiggiNFTREWARDS as BiggiNFTREWARDSABI,
} from "../config/abi/index.js";
import { getROProvider } from "../utils/contract";
import { ADDR } from "../utils/addresses";

const DEFAULT_DATA = {
  totalMinted: 0,
  baseURIs: { character: null, leaderboard: null, mystery: null },
  characterClaimed: {},
  leaderboardClaimed: {},
  mysteryClaimed: {},
  contractAddress: ADDR.NFT_REWARDS,
  mainContract: null,
};

export default function useNFTREWARDS(providerOverride = null) {
  const [data, setData] = React.useState(DEFAULT_DATA);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(
    async () => {
      setLoading(true);
      setError(null);
      try {
        const provider = providerOverride || getROProvider();
        if (!provider) throw new Error("Read-only provider not available");

        const address = ADDR.NFT_REWARDS;
        const mainAddress = ADDR.MAIN;
        if (!address && !mainAddress) {
          setData((prev) => ({ ...prev }));
          return;
        }

        const contract = address
          ? new Contract(address, BiggiNFTREWARDSABI, provider)
          : null;
        const mainContract = mainAddress
          ? new Contract(mainAddress, BiggiMainABI, provider)
          : null;

        const [nextRewardId, mainContractAddr] = await Promise.all([
          contract && typeof contract.nextRewardId === "function"
            ? contract.nextRewardId().catch(() => null)
            : Promise.resolve(null),
          contract && typeof contract.mainContract === "function"
            ? contract.mainContract().catch(() => null)
            : Promise.resolve(null),
        ]);

        const readMainBase = async () => {
          if (!mainContract) {
            return {
              charactersBaseURI: null,
              rewardsBaseURI: null,
              characterClaimed: {},
            };
          }
          const [charactersBaseURI, rewardsBaseURI] = await Promise.all([
            typeof mainContract.charactersBaseURI === "function"
              ? mainContract.charactersBaseURI().catch(() => null)
              : Promise.resolve(null),
            typeof mainContract.rewardsBaseURI === "function"
              ? mainContract.rewardsBaseURI().catch(() => null)
              : Promise.resolve(null),
          ]);
          const claimedResults = await Promise.all(
            Array.from({ length: 10 }, (_, idx) => {
              const blk = idx + 1;
              if (typeof mainContract.characterClaimed !== "function") {
                return Promise.resolve(false);
              }
              return mainContract.characterClaimed(blk).catch(() => false);
            }),
          );
          const characterClaimed = {};
          claimedResults.forEach((value, idx) => {
            characterClaimed[idx + 1] = Boolean(value);
          });
          return {
            charactersBaseURI,
            rewardsBaseURI,
            characterClaimed,
          };
        };

        const readRewardsStatus = async () => {
          if (!contract) {
            return {
              leaderboardClaimed: {},
              mysteryClaimed: {},
              derivedLeaderboardBase: null,
              derivedMysteryBase: null,
            };
          }
          const nextEventId = await (async () => {
            if (typeof contract.nextEventId !== "function") return null;
            return contract.nextEventId().catch(() => null);
          })();
          const lastEventId = Number(
            nextEventId?.toString ? nextEventId.toString() : nextEventId,
          );
          if (!Number.isFinite(lastEventId) || lastEventId <= 1) {
            return {
              leaderboardClaimed: {},
              mysteryClaimed: {},
              derivedLeaderboardBase: null,
              derivedMysteryBase: null,
            };
          }

          const maxEvents = 200;
          const startEventId = Math.max(1, lastEventId - maxEvents);
          const eventIds = [];
          for (let id = startEventId; id < lastEventId; id += 1) {
            eventIds.push(id);
          }
          const events = await Promise.all(
            eventIds.map((id) => contract.events(id).catch(() => null)),
          );

          const rewardQueue = [];
          const toNumber = (value) => {
            if (value == null) return NaN;
            const raw = value?.toString ? value.toString() : value;
            return Number(raw);
          };

          events.forEach((evt) => {
            if (!evt) return;
            const kind = toNumber(evt.kind ?? evt[0]);
            const rewardStartId = toNumber(
              evt.rewardStartId ?? evt.REWARDStartId ?? evt[2],
            );
            const rewardCount = toNumber(evt.rewardCount ?? evt[3]);
            if (!Number.isFinite(rewardStartId) || !Number.isFinite(rewardCount))
              return;
            if (rewardCount <= 0) return;
            if (kind !== 2 && kind !== 3) return;
            for (let i = 0; i < rewardCount; i += 1) {
              rewardQueue.push({
                kind,
                rewardId: rewardStartId + i,
              });
            }
          });

          const rewardInfos = await Promise.all(
            rewardQueue.map((reward) =>
              contract.rewardInfo(reward.rewardId).catch(() => null),
            ),
          );

          const leaderboardClaimed = {};
          const mysteryClaimed = {};
          let derivedLeaderboardBase = null;
          let derivedMysteryBase = null;
          let leaderboardCursor = 0;
          let mysteryCursor = 0;

          rewardQueue.forEach((reward, idx) => {
            const info = rewardInfos[idx];
            const isClaimed = Boolean(info?.isClaimed ?? info?.[1]);
            const uri = info?.uri ?? info?.[2] ?? null;
            const base =
              typeof uri === "string" && uri.includes("/")
                ? uri.slice(0, uri.lastIndexOf("/") + 1)
                : null;

            if (reward.kind === 2) {
              if (!derivedLeaderboardBase && base) {
                derivedLeaderboardBase = base;
              }
              const block = Math.floor(leaderboardCursor / 3) + 1;
              const rank = (leaderboardCursor % 3) + 1;
              if (block <= 10) {
                if (!leaderboardClaimed[block]) leaderboardClaimed[block] = {};
                leaderboardClaimed[block][rank] = isClaimed;
              }
              leaderboardCursor += 1;
              return;
            }

            if (reward.kind === 3) {
              if (!derivedMysteryBase && base) derivedMysteryBase = base;
              const block = mysteryCursor + 1;
              if (block <= 10) {
                mysteryClaimed[block] = Boolean(mysteryClaimed[block]) || isClaimed;
              }
              mysteryCursor += 1;
            }
          });

          return {
            leaderboardClaimed,
            mysteryClaimed,
            derivedLeaderboardBase,
            derivedMysteryBase,
          };
        };

        const [
          mainInfo,
          rewardsStatus,
        ] = await Promise.all([readMainBase(), readRewardsStatus()]);

        let totalMinted = 0;
        if (nextRewardId != null) {
          const nextId = Number(
            nextRewardId?.toString ? nextRewardId.toString() : nextRewardId,
          );
          if (Number.isFinite(nextId) && nextId > 0) {
            totalMinted = Math.max(0, nextId - 1);
          }
        }

        const mintedCharacters = Object.values(
          mainInfo.characterClaimed || {},
        ).filter(Boolean).length;
        const mintedLeaderboard = Object.values(
          rewardsStatus.leaderboardClaimed || {},
        ).reduce(
          (acc, ranks) =>
            acc +
            Object.values(ranks || {}).filter(Boolean).length,
          0,
        );
        const mintedMystery = Object.values(
          rewardsStatus.mysteryClaimed || {},
        ).filter(Boolean).length;
        const derivedTotalMinted =
          mintedCharacters + mintedLeaderboard + mintedMystery;

        const normalizeBase = (value) => {
          if (typeof value !== "string") return null;
          const trimmed = value.trim();
          return trimmed ? trimmed : null;
        };
        const characterBase = normalizeBase(mainInfo.charactersBaseURI);
        const rewardsBase = normalizeBase(mainInfo.rewardsBaseURI);
        const leaderboardBase = normalizeBase(
          rewardsStatus.derivedLeaderboardBase,
        );
        const mysteryBase = normalizeBase(rewardsStatus.derivedMysteryBase);

        setData((prev) => ({
          ...prev,
          totalMinted: derivedTotalMinted || totalMinted,
          baseURIs: {
            character: characterBase || prev.baseURIs?.character || null,
            leaderboard:
              rewardsBase ||
              leaderboardBase ||
              prev.baseURIs?.leaderboard ||
              null,
            mystery:
              rewardsBase || mysteryBase || prev.baseURIs?.mystery || null,
          },
          characterClaimed:
            Object.keys(mainInfo.characterClaimed || {}).length > 0
              ? mainInfo.characterClaimed
              : prev.characterClaimed,
          leaderboardClaimed:
            Object.keys(rewardsStatus.leaderboardClaimed || {}).length > 0
              ? rewardsStatus.leaderboardClaimed
              : prev.leaderboardClaimed,
          mysteryClaimed:
            Object.keys(rewardsStatus.mysteryClaimed || {}).length > 0
              ? rewardsStatus.mysteryClaimed
              : prev.mysteryClaimed,
          contractAddress: address,
          mainContract: mainContractAddr || prev.mainContract || null,
        }));
      } catch (e) {
        console.error("useNFTREWARDS.refresh", e);
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [providerOverride],
  );

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
