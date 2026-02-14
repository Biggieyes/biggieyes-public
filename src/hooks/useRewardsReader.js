import * as React from "react";
import { Contract } from "ethers";
import { ADDR } from "@/shared/utils/addresses";
import { getROProvider, ABI_REWARDS_READER } from "@/shared/utils/contract";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const resolveReaderAddress = () =>
  ADDR.BIGGI_REWARDS_READER || ADDR.COLLECTION_REWARDS_READER || null;

const buildFallback = () => ({
  reader: resolveReaderAddress(),
  tokenRewards: ADDR.TOKEN_REWARDS || null,
  collectionRewards: ADDR.COLLECTION_REWARDS || null,
  nftRewards: ADDR.NFT_REWARDS || null,
  treasury: ADDR.TREASURY || null,
  reserve: ADDR.RESERVE || null,
});

const isValidAddr = (addr) =>
  typeof addr === "string" &&
  /^0x[0-9a-fA-F]{40}$/.test(addr) &&
  addr !== ZERO_ADDRESS;

const safeCall = async (fn, fallback) => {
  if (typeof fn !== "function") return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

export default function useRewardsReader() {
  const [readerAddresses, setReaderAddresses] = React.useState(() =>
    buildFallback(),
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const provider = React.useMemo(() => {
    try {
      return getROProvider();
    } catch {
      return null;
    }
  }, []);

  const refresh = React.useCallback(async () => {
    const fallback = buildFallback();
    if (!provider || !fallback.reader || !ABI_REWARDS_READER?.length) {
      setReaderAddresses(fallback);
      setError(null);
      return fallback;
    }

    setLoading(true);
    setError(null);
    try {
      const contract = new Contract(
        fallback.reader,
        ABI_REWARDS_READER,
        provider,
      );
      const [tokenRewards, collectionRewards, nftRewards, treasury, reserve] =
        await Promise.all([
          safeCall(() => contract["tokenRewards"]?.(), fallback.tokenRewards),
          safeCall(
            () => contract.collectionRewards?.(),
            fallback.collectionRewards,
          ),
          safeCall(() => contract["nftRewards"]?.(), fallback.nftRewards),
          safeCall(() => contract.treasury?.(), fallback.treasury),
          safeCall(() => contract.reserve?.(), fallback.reserve),
        ]);

      const next = {
        reader: fallback.reader,
        tokenRewards: isValidAddr(tokenRewards)
          ? tokenRewards
          : fallback.tokenRewards,
        collectionRewards: isValidAddr(collectionRewards)
          ? collectionRewards
          : fallback.collectionRewards,
        nftRewards: isValidAddr(nftRewards) ? nftRewards : fallback.nftRewards,
        treasury: isValidAddr(treasury) ? treasury : fallback.treasury,
        reserve: isValidAddr(reserve) ? reserve : fallback.reserve,
      };

      setReaderAddresses(next);
      return next;
    } catch (err) {
      setError(err);
      setReaderAddresses(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [provider]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { readerAddresses, loading, error, refresh };
}
