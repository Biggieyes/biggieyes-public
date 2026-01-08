// BIGGI ECOSYSTEM panel - premium layout, safe fallbacks, live snapshot wiring

import * as React from "react";
import "../../components/panels/REWARDSPanel.css";
import "../../styles/biggi-token.skin.css";
import styles from "./styles/BiggiToken.module.css";
import LiquidityVaultChart from "../../components/TOKEN/LiquidityVaultChart.jsx";
import TokenSupplyChart from "../../components/TOKEN/TokenSupplyChart.jsx";
import DexLiquidityChart from "../../components/TOKEN/DexLiquidityChart.jsx";
import BiggiButton from "../../components/TOKEN/BiggiButton.jsx";
import FLOWButton from "../../components/TOKEN/FLOWButton.jsx";
import BUYBACKDRIPButton from "../../components/TOKEN/BUYBACKDRIPButton.jsx";
import LMReserveTokenDexButton from "../../components/TOKEN/LMReserveTokenDexButton.jsx";
import POLICYButton from "../../components/TOKEN/POLICYButton.jsx";
import { getBiggiBalancesAcrossReserveLmLv } from "../../services/composed.js";
import { BiggiLpPriceFeed as ABI_LP_PRICE_FEED } from "../../config/abi/index.js";
import { createBUYBACKService, createDRIPDistributorService } from "../../services/factories.js";
import { getROProvider, getSignerProvider, ensureAmoy, ADDR, AMOY } from "../../utils/contract.js";
import BiggiBUYBACKReader from "../../config/abi/BiggiBUYBACKReader.json";
import BiggiDRIPReader from "../../config/abi/BiggiDRIPReader.json";
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
} from "../../config/abi/index.js";
import TokenomicsPanel from "../../panels/TokenomicsPanel/TokenomicsPanel.jsx";
import DistributorTokenTab from "../../panels/TokenomicsPanel/tabs/DistributorTokenTab.jsx";
import DRIPTab from "../../panels/TokenomicsPanel/tabs/DRIPTab.jsx";
import BUYBACKTreasuryTab from "../../panels/TokenomicsPanel/tabs/BUYBACKTreasuryTab.jsx";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import useDRIPSnapshot from "../../HOOKS/tokenomics/useDRIPSnapshot.js";
import useDRIPHistory from "../../HOOKS/tokenomics/useDRIPHistory.js";
import useBUYBACKTreasurySnapshot from "../../HOOKS/tokenomics/useBUYBACKTreasurySnapshot.js";
import useBUYBACKTreasuryHistory from "../../HOOKS/tokenomics/useBUYBACKTreasuryHistory.js";
import useLiquiditySnapshot from "../../HOOKS/tokenomics/useLiquiditySnapshot.js";
import useLiquidityHistory from "../../HOOKS/tokenomics/useLiquidityHistory.js";
import useTokenDexSnapshot from "../../HOOKS/tokenomics/useTokenDexSnapshot.js";
import useTokenDexHistory from "../../HOOKS/tokenomics/useTokenDexHistory.js";
import useBUYBACKStabilityHistory from "../../HOOKS/tokenomics/useBUYBACKStabilityHistory.js";
import useBiggiToken from "../../HOOKS/useBiggiToken.js";
import useBiggiTokenomicsReader from "../../HOOKS/useBiggiTokenomicsReader.js";
import useBUYBACK from "../../HOOKS/useBUYBACK.js";
import useReserve from "../../HOOKS/useReserve.js";
import useTreasury from "../../HOOKS/useTreasury.js";
import usePOLICY from "../../HOOKS/usePOLICY.js";
import useDRIPDistributor from "../../HOOKS/useDRIPDistributor.js";
import useDRIPLM from "../../HOOKS/useDRIPLM.js";
import useLiquidityManager from "../../HOOKS/useLiquidityManager.js";
import useLiquidityVault from "../../HOOKS/useLiquidityVault.js";
import useLiquidityAutomation from "../../HOOKS/useLiquidityAutomation.js";
import useBUYBACKKeeper from "../../HOOKS/useBUYBACKKeeper.js";
import useLiquidityKeeper from "../../HOOKS/useLiquidityKeeper.js";
import useDRIPKeeper from "../../HOOKS/useDRIPKeeper.js";
import useDistributor from "../../HOOKS/useDistributor.js";

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








