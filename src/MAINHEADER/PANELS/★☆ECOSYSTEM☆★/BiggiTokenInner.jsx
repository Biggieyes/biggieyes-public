// BIGGI ecosystem panel - premium layout, safe fallbacks, live snapshot wiring

import * as React from "react";
import "../../components/panels/RewardsPanel.css";
import "../../styles/biggi-token.skin.css";
import styles from "./styles/BiggiToken.module.css";
import LiquidityVaultChart from "../../components/TOKEN/LiquidityVaultChart.jsx";
import TokenSupplyChart from "../../components/TOKEN/TokenSupplyChart.jsx";
import DexLiquidityChart from "../../components/TOKEN/DexLiquidityChart.jsx";
import BiggiButton from "../../components/TOKEN/BiggiButton.jsx";
import FlowButton from "../../components/TOKEN/FlowButton.jsx";
import BuybackDripButton from "../../components/TOKEN/BuybackDripButton.jsx";
import LMReserveTokenDexButton from "../../components/TOKEN/LMReserveTokenDexButton.jsx";
import PolicyButton from "../../components/TOKEN/PolicyButton.jsx";
import { getBiggiBalancesAcrossReserveLmLv } from "../../services/composed.js";
import { BiggiLpPriceFeed as ABI_LP_PRICE_FEED } from "../../config/abi/index.js";
import { createBuybackService, createDripDistributorService } from "../../services/factories.js";
import { getROProvider, getSignerProvider, ensureAmoy, ADDR, AMOY } from "../../utils/contract.js";
import BiggiBuybackReader from "../../config/abi/BiggiBuybackReader.json";
import BiggiDripReader from "../../config/abi/BiggiDripReader.json";
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
} from "../../config/abi/index.js";
import TokenomicsPanel from "../../panels/TokenomicsPanel/TokenomicsPanel.jsx";
import DistributorTokenTab from "../../panels/TokenomicsPanel/tabs/DistributorTokenTab.jsx";
import DripTab from "../../panels/TokenomicsPanel/tabs/DripTab.jsx";
import BuybackTreasuryTab from "../../panels/TokenomicsPanel/tabs/BuybackTreasuryTab.jsx";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import useDripSnapshot from "../../hooks/tokenomics/useDripSnapshot.js";
import useDripHistory from "../../hooks/tokenomics/useDripHistory.js";
import useBuybackTreasurySnapshot from "../../hooks/tokenomics/useBuybackTreasurySnapshot.js";
import useBuybackTreasuryHistory from "../../hooks/tokenomics/useBuybackTreasuryHistory.js";
import useLiquiditySnapshot from "../../hooks/tokenomics/useLiquiditySnapshot.js";
import useLiquidityHistory from "../../hooks/tokenomics/useLiquidityHistory.js";
import useTokenDexSnapshot from "../../hooks/tokenomics/useTokenDexSnapshot.js";
import useTokenDexHistory from "../../hooks/tokenomics/useTokenDexHistory.js";
import useBuybackStabilityHistory from "../../hooks/tokenomics/useBuybackStabilityHistory.js";
import useBiggiToken from "../../hooks/useBiggiToken.js";
import useBiggiTokenomicsReader from "../../hooks/useBiggiTokenomicsReader.js";
import useBuyback from "../../hooks/useBuyback.js";
import useReserve from "../../hooks/useReserve.js";
import useTreasury from "../../hooks/useTreasury.js";
import usePolicy from "../../hooks/usePolicy.js";
import useDripDistributor from "../../hooks/useDripDistributor.js";
import useDripLM from "../../hooks/useDripLM.js";
import useLiquidityManager from "../../hooks/useLiquidityManager.js";
import useLiquidityVault from "../../hooks/useLiquidityVault.js";
import useLiquidityAutomation from "../../hooks/useLiquidityAutomation.js";
import useBuybackKeeper from "../../hooks/useBuybackKeeper.js";
import useLiquidityKeeper from "../../hooks/useLiquidityKeeper.js";
import useDripKeeper from "../../hooks/useDripKeeper.js";
import useDistributor from "../../hooks/useDistributor.js";

// Modularized component imports
import Card from "./components/Card";
import Line from "./components/Line";
import AddressLine from "./components/AddressLine";
import HeroStat from "./components/HeroStat";
import SectionHeader from "./components/SectionHeader";
import Button from "./components/Button";

import {
  withTimeout,
  fmtVal,
  fmtLp,
  numFrom,
  shortAddr,
  isAddress,
  explorerLink,
  fmtDate

