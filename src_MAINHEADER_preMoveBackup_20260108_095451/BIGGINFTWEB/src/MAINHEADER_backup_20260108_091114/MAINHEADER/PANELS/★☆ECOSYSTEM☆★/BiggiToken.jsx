
// BIGGI ECOSYSTEM panel - premium layout, safe fallbacks, live snapshot wiring

import * as React from "react";
import "../panels/REWARDSPanel.css";
import "../../styles/biggi-token.skin.css";
import styles from "./BiggiToken.module.css";
import LiquidityVaultChart from "./LiquidityVaultChart";
import TokenSupplyChart from "./TokenSupplyChart";
import DexLiquidityChart from "./DexLiquidityChart";
import BiggiButton from "./BiggiButton";
import FLOWButton from "./FLOWButton";
import BUYBACKDRIPButton from "./BUYBACKDRIPButton";
import LMReserveTokenDexButton from "./LMReserveTokenDexButton";
import POLICYButton from "./POLICYButton";
import { getBiggiBalancesAcrossReserveLmLv } from "../../services/composed.js";
import { BiggiLpPriceFeed as ABI_LP_PRICE_FEED } from "../../config/abi/index.js";
import { createBUYBACKService, createDRIPDistributorService } from "../../services/factories.js";
import { getROProvider, getSignerProvider, ensureAmoy, ADDR, AMOY } from "../../utils/contract.js";
// import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers"; // odstraněno duplicitně
import BiggiBUYBACKReader from "../../config/abi/BiggiBUYBACKReader.json";
import BiggiDRIPReader from "../../config/abi/BiggiDRIPReader.json";
  // --- On-chain BUYBACK and DRIP balances via their readers ---
  const [onchainBUYBACK, setOnchainBUYBACK] = React.useState({ biggi: null, matic: null, loading: false, error: null });
  const [onchainDRIP, setOnchainDRIP] = React.useState({ biggi: null, matic: null, loading: false, error: null });
  React.useEffect(() => {
    let cancelled = false;
    async function fetchBUYBACKOnchain() {
      setOnchainBUYBACK((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const provider = getROProvider();
        const reader = new Contract(ADDR.BUYBACK_READER, ABI_BUYBACK_READER, provider);
        const summary = await reader.simpleSummary();
        if (cancelled) return;
        setOnchainBUYBACK({
          biggi: Number(ethers.utils.formatUnits(summary.biggiHeld, 18)),
          matic: Number(formatEther(summary.maticHeld)),
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setOnchainBUYBACK((prev) => ({ ...prev, loading: false, error: err?.message || String(err) }));
      }
    }
    async function fetchDRIPOnchain() {
      setOnchainDRIP((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const provider = getROProvider();
        const reader = new Contract(ADDR.DRIP_READER, ABI_DRIP_READER, provider);
        const summary = await reader.simpleSummary();
        if (cancelled) return;
        setOnchainDRIP({
          biggi: Number(ethers.utils.formatUnits(summary.biggiHeld, 18)),
          matic: Number(formatEther(summary.maticHeld)),
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setOnchainDRIP((prev) => ({ ...prev, loading: false, error: err?.message || String(err) }));
      }
    }
    fetchBUYBACKOnchain();
    fetchDRIPOnchain();
    return () => { cancelled = true; };
  }, []);
import { getProvider } from "../../web3/provider.js";
import TokenREWARDSService from "../../services/tokenREWARDSService.js";
import {
  BiggiLiquidityManager as ABI_LM,
  UniswapV2Pair as ABI_PAIR,
  LiquidityVault as ABI_LIQUIDITY_VAULT,
  BiggiToken as ABI_TOKEN,
  BiggiBUYBACKAgent as ABI_BUYBACK,
  BiggiPOLICY as ABI_POLICY,
  DRIPLM as ABI_DRIPLM,
    DRIPDistributor as ABI_DRIP_DISTRIBUTOR,
    // Pokud máš ABI_UPKEEP a ABI_ROUTER v config/abi, přidej je zde
  };







