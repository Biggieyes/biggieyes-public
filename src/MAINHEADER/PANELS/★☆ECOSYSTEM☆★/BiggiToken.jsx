
// BIGGI ecosystem panel - premium layout, safe fallbacks, live snapshot wiring

import * as React from "react";
import "../panels/RewardsPanel.css";
import "../../styles/biggi-token.skin.css";
import styles from "./BiggiToken.module.css";
import LiquidityVaultChart from "./LiquidityVaultChart";
import TokenSupplyChart from "./TokenSupplyChart";
import DexLiquidityChart from "./DexLiquidityChart";
import BiggiButton from "./BiggiButton";
import FlowButton from "./FlowButton";
import BuybackDripButton from "./BuybackDripButton";
import LMReserveTokenDexButton from "./LMReserveTokenDexButton";
import PolicyButton from "./PolicyButton";
import { getBiggiBalancesAcrossReserveLmLv } from "../../services/composed.js";
import { BiggiLpPriceFeed as ABI_LP_PRICE_FEED } from "../../config/abi/index.js";
import { createBuybackService, createDripDistributorService } from "../../services/factories.js";
import { getROProvider, getSignerProvider, ensureAmoy, ADDR, AMOY } from "../../utils/contract.js";
// import { ethers } from "ethers"; // odstraněno duplicitně
import BiggiBuybackReader from "../../config/abi/BiggiBuybackReader.json";
import BiggiDripReader from "../../config/abi/BiggiDripReader.json";
  // --- On-chain buyback and drip balances via their readers ---
  const [onchainBuyback, setOnchainBuyback] = React.useState({ biggi: null, matic: null, loading: false, error: null });
  const [onchainDrip, setOnchainDrip] = React.useState({ biggi: null, matic: null, loading: false, error: null });
  React.useEffect(() => {
    let cancelled = false;
    async function fetchBuybackOnchain() {
      setOnchainBuyback((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const provider = getROProvider();
        const reader = new ethers.Contract(ADDR.BUYBACK_READER, ABI_BUYBACK_READER, provider);
        const summary = await reader.simpleSummary();
        if (cancelled) return;
        setOnchainBuyback({
          biggi: Number(ethers.utils.formatUnits(summary.biggiHeld, 18)),
          matic: Number(ethers.utils.formatEther(summary.maticHeld)),
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setOnchainBuyback((prev) => ({ ...prev, loading: false, error: err?.message || String(err) }));
      }
    }
    async function fetchDripOnchain() {
      setOnchainDrip((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const provider = getROProvider();
        const reader = new ethers.Contract(ADDR.DRIP_READER, ABI_DRIP_READER, provider);
        const summary = await reader.simpleSummary();
        if (cancelled) return;
        setOnchainDrip({
          biggi: Number(ethers.utils.formatUnits(summary.biggiHeld, 18)),
          matic: Number(ethers.utils.formatEther(summary.maticHeld)),
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setOnchainDrip((prev) => ({ ...prev, loading: false, error: err?.message || String(err) }));
      }
    }
    fetchBuybackOnchain();
    fetchDripOnchain();
    return () => { cancelled = true; };
  }, []);
import { getProvider } from "../../web3/provider.js";
import TokenRewardsService from "../../services/tokenRewardsService.js";
import {
  BiggiLiquidityManager as ABI_LM,
  UniswapV2Pair as ABI_PAIR,
  LiquidityVault as ABI_LIQUIDITY_VAULT,
  BiggiToken as ABI_TOKEN,
  BiggiBuybackAgent as ABI_BUYBACK,
  BiggiPolicy as ABI_POLICY,
  DripLM as ABI_DRIPLM,
    DripDistributor as ABI_DRIP_DISTRIBUTOR,
    // Pokud máš ABI_UPKEEP a ABI_ROUTER v config/abi, přidej je zde
  };
