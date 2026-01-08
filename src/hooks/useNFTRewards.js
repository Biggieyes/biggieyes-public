// src/HOOKS/useNFTREWARDS.js
import * as React from "react";
import { getROProvider } from "../utils/contract";

const DEFAULT_DATA = {
  totalMinted: 0,
  contractAddress: "0x2bb882F8657d13AEccA90bE6Bb62166d1572C5D4",
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

        // REWARDSReader contract instance
        // const REWARDSReader = new Contract(
        //   "0x2bb882F8657d13AEccA90bE6Bb62166d1572C5D4",
        //   ABI_REWARDS_READER,
        //   provider,
        // );

        // Čtení NFT REWARDS (příklad: totalMinted lze získat z jiné metody pokud je v ABI)
        // Zde pouze placeholder, upravte podle skutečné metody v ABI
        // const nftStats = await REWARDSReader.nftREWARDSStats();
        // setData((prev) => ({ ...prev, totalMinted: nftStats.totalMinted }));

        setData((prev) => ({ ...prev }));
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



