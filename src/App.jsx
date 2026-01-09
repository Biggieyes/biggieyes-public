import * as React from "react";
import "./App.css";
import { MODAL_TEXTS } from "./constants/texts";
// --- Pďż˝idanďż˝ importy pro napojenďż˝ dosud nepouďż˝ďż˝vanďż˝ch souborďż˝ ---
import AdminDashboard from "./components/AdminDashboard.jsx";
import IconButton from "./components/common/IconButton.jsx";
import ModalTopbar from "./components/common/ModalTopbar.jsx";
import ExpansionPanel from "./components/expansion/ExpansionPanel.jsx";
import PinUploader from "./components/PinUploader.jsx";
import RedeemFLOW from "./ACTIONBUTTONS/REDEEMTICKET/RedeemFlow.jsx";
import REWARDSBlockSummary from "./panels/Rewards/REWARDSBlockSummary.jsx";
import BiggiButton from "./components/TOKEN/BiggiButton.jsx";
import BUYBACKDRIPButton from "./components/TOKEN/BuybackDripButton.jsx";
import BUYBACKStabilityChart from "./components/TOKEN/BuybackStabilityChart.jsx";
import DexLiquidityChart from "./components/TOKEN/DexLiquidityChart.jsx";
import FLOWButton from "./components/TOKEN/FlowButton.jsx";
import LiquidityVaultChart from "./components/TOKEN/LiquidityVaultChart.jsx";
import LMReserveTokenDexButton from "./components/TOKEN/LMReserveTokenDexButton.jsx";
import POLICYButton from "./components/TOKEN/PolicyButton.jsx";
import * as RechartsCompat from "./components/TOKEN/recharts-compat.js";
import SimpleLineChart from "./components/TOKEN/SimpleLineChart.jsx";
import TokenSupplyChart from "./components/TOKEN/TokenSupplyChart.jsx";
import ADDR from "./config/addresses.js";
import * as BLOCK_CONST from "./constants/block.js";
import BLOCK_IMAGES from "./constants/blockImages.js";
import BLOCKSIMAGES from "./constants/blocksimages.js";
import * as UI_CONST from "./UI/ui.js";
import * as DeviceHOOKS from "./UI/Device.js";
import WalletButton from "./MAINHEADER/WalletButton.jsx";
import LoadingOverlay from "./components/LoadingOverlay.jsx";
// import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { formatUnits, parseUnits } from "@ethersproject/units";
import { getAddress } from "@ethersproject/address";
import { keccak256 } from "@ethersproject/keccak256";
import { Interface } from "@ethersproject/abi";
import { JsonRpcProvider, FallbackProvider, Web3Provider, StaticJsonRpcProvider } from "@ethersproject/providers";

//: ./../utils/contract.js
import {
  ensureAmoy,
  getReadOnlyMain as getReadOnlyContract,
  getMain as getContract,
  getLMRO as getReadOnlyLiquidityContract,
  getLM as getLiquidityContract,
  getReaderRO,
  getROProvider,
  getSignerProvider,
  getPOLICYRO,
  getPOLICY,
  getBUYBACKRO,
  getDistributorRO,
  resetROProvider,
  getReserve,
  getBiggiTokenomicsReaderRO,
} from "./utils/contract";

import { useContracts } from "./providers/ContractsProvider";
import "./styles/biggi-token.skin.css";
import MainLayout from "./components/layout/MainLayout";
import ModalsLayer from "./components/layout/ModalsLayer";
import { prettyError } from "./utils/errors";
import { formatEthNum } from "./utils/format";
import { resolveImageUrl, readJsonFromURI } from "./utils/ipfs";
import { callFirst, getRO as getROHelper } from "./utils/contracts-helpers";
import { fetchCOMMUNITYCENTERStats as fetchCOMMUNITYCENTERStatsRO } from "./utils/community";
import NavPanelSwitch from "./panels/Common/NavPanelSwitch.jsx";
import { useNavHotkeys } from "./HOOKS/useNavHotkeys";
import { useGlobalShortcuts } from "./HOOKS/useGlobalShortcuts";
import { useStatsREWARDS } from "./HOOKS/useStatsREWARDS";
import { useAdminActions } from "./HOOKS/useAdminActions";
import useDistributor from "./HOOKS/useDistributor";
import useTransparencyData from "./HOOKS/useTransparencyData";
import AppCore from "./app/AppCore";
import {
  BACKGROUND_NAMES,
  getSafeDeployBlock,
  queryLogsBatched,
  ERC20_MINI,
} from "./utils/shared";
import {
  mergeAttrs,
  getCachedPriceAttrs,
  setCachedPriceAttrs,
} from "./utils/metadata";
import {
  buildVRFHistory as buildVRFHistoryUtil,
  resolvePendingFromHistoryOrOwnership as resolvePendingFromHistoryOrOwnershipUtil,
  refreshVRFPanel as refreshVRFPanelUtil,
  checkVRFResolution as checkVRFResolutionUtil,
  openVRFExplorer,
} from "./utils/VRF";
import { useWalletAssets } from "./HOOKS/useWalletAssets";
import { useMintRedeem } from "./HOOKS/useMintRedeem";
import { parseEth, writeFirst, setVRFAllOrPartial } from "./utils/adminActions";
import {
  refreshRouterInfo,
  refreshLiquidityPreview,
  refreshBUYBACKInfo,
  fetchReserveInfo as fetchReserveInfoUtil,
  fetchTreasuryInfo as fetchTreasuryInfoUtil,
  refreshREWARDS,
} from "./utils/tokenRefreshers";
import { refreshTokenMeta } from "./utils/tokenMeta";
import { refreshPOLICY } from "./utils/POLICY";

/* ========= LAZY LOADED HEAVY PANELS ========= */
const FullscreenPanel = React.lazy(
  () => import("./components/common/FullscreenPanel"),
);
const AdminPanel = React.lazy(() => import("./components/admin/AdminPanel"));

const pickInjectedProvider = () => {
  return ethereum;
};
// Nav panel contents are React.lazy-loaded inside `NavPanelSwitch`.

/* ======================================================================== */
/* ============================== CONSTANTS ================================ */
/* ======================================================================== */

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/* ?? MINI ERC20 ABI pro ďż˝tenďż˝ */
/* ======================================================================== */
/* ============================== SMALL UTILS ============================== */
/* ======================================================================== */

/* ======================================================================== */
/* ================================= UI ==================================== */
/* ======================================================================== */

// ?? WalletConnect helper
const connectWithWalletConnect = async () => {
  try {
    const mod = await import("./wallet/wc");
    if (mod && typeof mod.connectWithWalletConnect === "function") {
      return await mod.connectWithWalletConnect();
    }
    throw new Error("WalletConnect is not available in this version");
  } catch (error) {
    console.error("WalletConnect error:", error);
    throw new Error("WalletConnect is not available right now");
  }
};

function App() {
  // Pďż˝ďż˝stup ke vďż˝em contract factory pďż˝es context
  const contracts = useContracts();
  // DEMO: pouďż˝itďż˝ contract factory z contextu
  React.useEffect(() => {
    // Pďż˝ďż˝klad volďż˝nďż˝ BiggiMainReader a BiggiTokenomicsReader
    try {
      const mainReader = contracts.biggiMainReaderRead?.();
      const tokenomicsReader = contracts.biggiTokenomicsReaderRead?.();
      // Mďż˝ďż˝eďż˝ zde volat metody na tďż˝chto instancďż˝ch, napďż˝. mainReader.nďż˝co()
      // console.log("mainReader", mainReader);
      // console.log("tokenomicsReader", tokenomicsReader);
    } catch (e) {
      // ignore if not available
    }
  }, [contracts]);
  const [openNavIdx, setOpenNavIdx] = React.useState(null);
  const [walletAddress, setWalletAddress] = React.useState("");

  const [ticketPrice, setTicketPrice] = React.useState(null);
  const [biggiMinted, setBiggiMinted] = React.useState(0);
  const [maxSupply] = React.useState(550);
  const [ticketMinted, setTicketMinted] = React.useState(0);
  const [maxTickets] = React.useState(550);
  const [blockMintCounts, setBlockMintCounts] = React.useState(
    new Array(10).fill(0),
  );
  const [blockPrices, setBlockPrices] = React.useState(new Array(10).fill(0));
  const [backgroundMintCounts, setBackgroundMintCounts] = React.useState(
    new Array(10).fill(0),
  );

  const [myNFTs, setMyNFTs] = React.useState([]);
  const [galleryLoading, setGalleryLoading] = React.useState(false);
  const [galleryNotice, setGalleryNotice] = React.useState("");
  const [zoomImg, setZoomImg] = React.useState(null);

  const [lastMinted, setLastMinted] = React.useState({
    tokenId: "-",
    image: "/images/Biggi.png",
    blockName: "-",
    backgroundName: "-",
  });

  const [dynamicTraitsById, setDynamicTraitsById] = React.useState({});
  const [rewardPool, setRewardPool] = React.useState(null);
  const [myClaimable, setMyClaimable] = React.useState(null);
  const [mintVolumeMatic, setMintVolumeMatic] = React.useState(null);
  const onRefreshTokenMetaRef = React.useRef(() => {});

  const sleep = React.useCallback(
    (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    [],
  );

  const withRetry = React.useCallback(
    async (fn, { attempts = 3, delayMs = 700 } = {}) => {
      let lastErr;
      for (let i = 0; i < attempts; i += 1) {
        try {
          return await fn();
        } catch (err) {
          lastErr = err;
          const msg = err?.message || "";
          const is429 = /429|Too Many Requests/i.test(msg);
          if (i === attempts - 1 || !is429) break;
          await sleep(delayMs * (i + 1));
        }
      }
      throw lastErr;
    },
    [sleep],
  );

  const [biggiData, setBiggiData] = React.useState({
    token: {},
    REWARDS: {},
    router: {},
    liquidity: {},
    POLICY: {},
    BUYBACK: {},
  });
  const [VRFUIData, setVRFUIData] = React.useState({
    network: "EVM",
    subscription: { id: "", linkBalance: "", consumers: [] },
    params: {
      keyHash: "",
      confirmations: 3,
      numWords: 1,
      callbackGasLimit: 300000,
    },
    last: {
      requestId: "",
      status: "idle",
      requestedAt: "",
      txHash: "",
      blockNumber: undefined,
      randomWords: [],
    },
    history: [],
  });

  const [VRFPending, setVRFPending] = React.useState(false);
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [claimPerforming, setClaimPerforming] = React.useState(false);
  const [claimError, setClaimError] = React.useState(null);
  const [redeemMsg, setRedeemMsg] = React.useState("");
  const [redeemStartBlock, setRedeemStartBlock] = React.useState(null);
  const [redeemStartedAt, setRedeemStartedAt] = React.useState(null);
  const [pendingTicketId, setPendingTicketId] = React.useState(null);
  const [topFirstId, setTopFirstId] = React.useState(null);

  const [adminOpen, setAdminOpen] = React.useState(false);
  const [cardsHelpOpen, setCardsHelpOpen] = React.useState(false);
  const [adminOwner, setAdminOwner] = React.useState("");

  useGlobalShortcuts({
    zoomImg,
    setZoomImg,
    adminOpen,
    setAdminOpen,
    openNavIdx,
    setOpenNavIdx,
    cardsHelpOpen,
    setCardsHelpOpen,
  });

  const contractRef = React.useRef(null);
  const unsubRef = React.useRef(() => {});
  const mintIdxCacheRef = React.useRef(new Map());

  const [epochStartTs, setEpochStartTs] = React.useState(null);
  const [userLastClaimTs, setUserLastClaimTs] = React.useState(null);

  const isMobile = DeviceHOOKS.useIsMobile(700);
  const { data: distributorData, refresh: fetchDistributorInfo } =
    useDistributor();
  const {
    data: transparencyData,
    loading: transparencyLoading,
    refreshTransparency,
  } = useTransparencyData({ enabled: true });

  const getRO = React.useCallback(
    () => getROHelper(contractRef, getReadOnlyContract),
    [],
  );

  const isAdmin =
    adminOwner &&
    walletAddress &&
    adminOwner.toLowerCase() === walletAddress.toLowerCase();

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = contractRef.current || getReadOnlyContract();
        if (c && typeof c.owner === "function") {
          const addr = await c.owner().catch(() => "");
          if (!cancelled) setAdminOwner(addr || "");
        } else if (!cancelled) {
          setAdminOwner("");
        }
      } catch {
        if (!cancelled) setAdminOwner("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getReadOnlyContract]);

  React.useEffect(() => {
    if (!isAdmin && adminOpen) setAdminOpen(false);
  }, [isAdmin, adminOpen]);

  const openAdmin = React.useCallback(() => {
    if (!isAdmin) return;
    setAdminOpen(true);
  }, [isAdmin]);

  const onRefreshPOLICY = React.useCallback(async () => {
    try {
      await refreshPOLICY({ getPOLICYRO, setBiggiData });
    } catch (e) {
      console.error("onRefreshPOLICY", e);
    }
  }, [getPOLICYRO]);
  const getNftIndexForTokenId = React.useCallback(async (contract, tokenId) => {
    const key = String(tokenId);
    const cached = mintIdxCacheRef.current.get(key);
    if (cached) return cached;
    try {
      const latest = await contract.provider.getBlockNumber();
      const from = await getSafeDeployBlock(contract.provider);
      const logs = await queryLogsBatched(
        contract,
        contract.filters.NFTMinted(),
        from,
        latest,
      );
      for (let i = logs.length - 1; i >= 0; i--) {
        const l = logs[i];
        const tid = l.args?.tokenId || l.args?.[1];
        if (tid && tid.toString() === key) {
          const idx = l.args?.nftIndex || l.args?.[2];
          if (idx) {
            const n = Number(idx.toString());
            mintIdxCacheRef.current.set(key, n);
            return n;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const { fetchStats, fetchREWARDS } = useStatsREWARDS({
    setTicketPrice,
    setTicketMinted,
    setBiggiMinted,
    setBlockPrices,
    setBlockMintCounts,
    setBackgroundMintCounts,
    setRewardPool,
    setMintVolumeMatic,
    walletAddress,
    myNFTs,
    setMyClaimable,
  });

  const enrichMetaWithPrices = React.useCallback(
    async (_contract, tokenId, meta) => {
      try {
        const cached = getCachedPriceAttrs(tokenId);
        let attrs = Array.isArray(meta?.attributes) ? [...meta.attributes] : [];
        if (cached) attrs = mergeAttrs(attrs, cached);

        try {
          const reader = getReaderRO();
          const [tp, bp, fp] = await reader.getMintDataByTokenId(
            BigInt(String(tokenId)),
          );
          const ticket = formatEthNum(tp);
          const blockP = formatEthNum(bp);
          const finalP = formatEthNum(fp);

          const pushOrReplace = (trait_type, value) => {
            const i = attrs.findIndex(
              (a) => String(a?.trait_type) === trait_type,
            );
            const v = value != null ? `${value.toFixed(4)} POL` : "\u2014";
            if (i === -1) attrs.push({ trait_type, value: v });
            else attrs[i] = { ...attrs[i], value: v };
          };

          pushOrReplace("Ticket Price", ticket);
          pushOrReplace("Block Price", blockP);
          pushOrReplace("Final Price", finalP);

          setCachedPriceAttrs(tokenId, attrs);
        } catch {}

        return { ...(meta || {}), attributes: attrs };
      } catch {
        return meta;
      }
    },
    [],
  );

  const {
    fetchMyTickets,
    fetchOwnedNFTsViaTransfers,
    fetchWalletAssets,
    fetchLastMinted,
    fetchDynamicTraitsFor,
  } = useWalletAssets({
    contractRef,
    setMyNFTs,
    setGalleryLoading,
    setGalleryNotice,
    setLastMinted,
    setDynamicTraitsById,
    VRFPending,
    topFirstId,
    pendingTicketId,
    redeemStartBlock,
    redeemStartedAt,
    setTopFirstId,
    setPendingTicketId,
    setVRFPending,
    setIsRedeeming,
    setRedeemMsg,
    enrichMetaWithPrices,
  });

  /* ---------- Stats pďż˝es Reader ---------- */

  const fetchBackgroundMintCounts = React.useCallback(async () => {
    try {
      const reader = getReaderRO();
      const counts = await reader.getAllBackgroundMintCounts();
      setBackgroundMintCounts(counts.map((x) => Number(x)));
    } catch (e) {
      console.error("fetchBackgroundMintCounts(reader)", e);
      setBackgroundMintCounts(new Array(10).fill(0));
    }
  }, []);

  // findTicketsViaLogs moved to useWalletAssets

  // fetchOwnedNFTsViaOwnerScan moved to useWalletAssets

  // fetchOwnedNFTsViaTransfers moved to useWalletAssets

  // mergeWithTopFirst moved to useWalletAssets

  // fetchWalletAssets moved to useWalletAssets

  // fetchDynamicTraitsFor moved to useWalletAssets

  const preflightRedeemCheck = React.useCallback(async (contract) => {
    try {
      if (typeof contract?.findUnsetIndices === "function") {
        const unset = await contract.findUnsetIndices();
        const missing = Array.from(unset || []);
        if (missing.length > 0) {
          const sample = missing
            .slice(0, 10)
            .map((x) => x.toString())
            .join(", ");
          const e = new Error(
            `NotFullyConfigured: ${missing.length} unset NFT indices (sample: ${sample}).`,
          );
          e.errorName = "NotFullyConfigured";
          throw e;
        }
      } else if (typeof contract?.nftInfo === "function") {
        const picks = [1, 55, 110, 275, 550];
        for (const i of picks) {
          try {
            const info = await contract.nftInfo(i);
            const b = Number(info?.background || info?.[0] || 0);
            const bl = Number(info?.blockIdx || info?.[1] || 0);
            const m = Number(info?.mainId || info?.[2] || 0);
            if (
              !(b >= 1 && b <= 10 && bl >= 1 && bl <= 10 && m >= 1 && m <= 10)
            ) {
              const e = new Error(
                `NotFullyConfigured: index ${i} invalid (background=${b}, blockIdx=${bl}, mainId=${m}).`,
              );
              e.errorName = "NotFullyConfigured";
              throw e;
            }
          } catch {}
        }
      }
    } catch (e) {
      const err = new Error(e?.message || "NotFullyConfigured");
      err.errorName = e?.errorName || "NotFullyConfigured";
      throw err;
    }
  }, []);

  const claimREWARDS = React.useCallback(async () => {
    if (!walletAddress) return alert("Please connect MetaMask first.");
    setClaimPerforming(true);
    setClaimError(null);
    try {
      await ensureAmoy();

      let tokenIds = myNFTs
        .filter((x) => !x.isTicket)
        .map((x) => BigInt(x.tokenId));

      if (!tokenIds.length) {
        const contract = contractRef.current || getReadOnlyContract();
        const latest = await contract.provider.getBlockNumber();
        const FROM = await getSafeDeployBlock(contract.provider);
        const toFilter = contract.filters.Transfer(null, walletAddress, null);
        const fromFilter = contract.filters.Transfer(walletAddress, null, null);
        const [toLogs, fromLogs] = await Promise.all([
          queryLogsBatched(contract, toFilter, FROM, latest),
          queryLogsBatched(contract, fromFilter, FROM, latest),
        ]);
        const all = [...toLogs, ...fromLogs].sort((a, b) => {
          if (a.blockNumber !== b.blockNumber)
            return a.blockNumber - b.blockNumber;
          return a.logIndex - b.logIndex;
        });
        const held = new Set();
        const me = String(walletAddress || "").toLowerCase();
        for (const l of all) {
          const from = String(l.args?.from ?? l.args?.[0] ?? "").toLowerCase();
          const to = String(l.args?.to ?? l.args?.[1] ?? "").toLowerCase();
          const tid = (l.args?.tokenId ?? l.args?.[2])?.toString?.() || "";
          if (!tid) continue;
          if (to === me) held.add(tid);
          if (from === me) held.delete(tid);
        }
        const arr = Array.from(held);
        const nonTickets = [];
        for (const tid of arr) {
          try {
            const isT =
              typeof contract?.isTicket === "function"
                ? await contract.isTicket(tid)
                : false;
            if (!isT) nonTickets.push(BigInt(tid));
          } catch {
            nonTickets.push(BigInt(tid));
          }
        }
        tokenIds = nonTickets;
      }

      if (!tokenIds.length) {
        return alert("No eligible NFTs to claim this week.");
      }

      const brl = await getLiquidityContract();
      const tx = await brl.claim(tokenIds);
      await tx.wait();

      await fetchREWARDS();
      await fetchStats();
      alert("REWARDS claimed.");
    } catch (err) {
      setClaimError(err);
      alert("Claim failed: " + prettyError(err));
      console.error("claimREWARDS", err);
    } finally {
      setClaimPerforming(false);
    }
  }, [walletAddress, myNFTs, fetchREWARDS, fetchStats, prettyError]);

  const fetchCOMMUNITYCENTERStats = React.useCallback(
    fetchCOMMUNITYCENTERStatsRO,
    [],
  );

  const onRefreshTokenMeta = React.useCallback(async () => {
    try {
      await withRetry(() =>
        refreshTokenMeta({
          getReadOnlyLiquidityContract,
          callFirst,
          getBiggiTokenomicsReaderRO,
          fetchCOMMUNITYCENTERStats,
          setBiggiData,
        }),
      );
    } catch (e) {
      console.error("onRefreshTokenMeta", e);
    }
  }, [
    getReadOnlyLiquidityContract,
    callFirst,
    getBiggiTokenomicsReaderRO,
    fetchCOMMUNITYCENTERStats,
    withRetry,
  ]);

  React.useEffect(() => {
    onRefreshTokenMetaRef.current = onRefreshTokenMeta;
  }, [onRefreshTokenMeta]);

  const onRefreshREWARDS = React.useCallback(
    async (tokenIdsCsv = "") => {
      try {
        await withRetry(() =>
          refreshREWARDS({
            getReadOnlyLiquidityContract,
            setBiggiData,
            tokenIdsCsv,
          }),
        );
      } catch (e) {
        console.error("onRefreshREWARDS", e);
      }
    },
    [getReadOnlyLiquidityContract, withRetry],
  );

  const onRefreshRouterInfo = React.useCallback(async () => {
    try {
      await withRetry(() =>
        refreshRouterInfo({
          getReadOnlyLiquidityContract,
          onRefreshPOLICY,
          setBiggiData,
        }),
      );
    } catch (e) {
      console.error("onRefreshRouterInfo", e);
    }
  }, [getReadOnlyLiquidityContract, onRefreshPOLICY, withRetry]);

  const onRefreshLiquidityPreview = React.useCallback(async () => {
    try {
      await withRetry(() =>
        refreshLiquidityPreview({ getReadOnlyLiquidityContract, setBiggiData }),
      );
    } catch (e) {
      console.error("onRefreshLiquidityPreview", e);
    }
  }, [getReadOnlyLiquidityContract, withRetry]);

  const onRefreshBUYBACKInfo = React.useCallback(async () => {
    try {
      await withRetry(() =>
        refreshBUYBACKInfo({
          getBUYBACKRO,
          getReadOnlyLiquidityContract,
          ERC20_MINI,
          setBiggiData,
        }),
      );
    } catch (e) {
      console.error("onRefreshBUYBACKInfo", e);
    }
  }, [withRetry]);

  const fetchReserveInfo = React.useCallback(async () => {
    try {
      return await fetchReserveInfoUtil({
        contractRef,
        getReadOnlyContract,
        callFirst,
        setBiggiData,
        ZERO_ADDRESS,
      });
    } catch (e) {
      console.error("fetchReserveInfo", e);
      return {};
    }
  }, [contractRef, getReadOnlyContract, callFirst]);

  const fetchTreasuryInfo = React.useCallback(async () => {
    try {
      return await fetchTreasuryInfoUtil({
        getReadOnlyLiquidityContract,
        callFirst,
        ERC20_MINI,
        setBiggiData,
      });
    } catch (e) {
      console.error("fetchTreasuryInfo", e);
      return {};
    }
  }, [getReadOnlyLiquidityContract, callFirst]);

  const adminActions = useAdminActions({
    getContract,
    getLiquidityContract,
    getPOLICY,
    ensureAmoy,
    fetchStats,
    fetchREWARDS,
    onRefreshRouterInfo,
    onRefreshLiquidityPreview,
    onRefreshPOLICY,
    onRefreshREWARDS,
    onRefreshTokenMeta,
    onRefreshBUYBACKInfo,
    fetchTreasuryInfo,
    fetchReserveInfo,
  });

  const buildVRFHistory = React.useCallback(buildVRFHistoryUtil, []);

  const resolvePendingFromHistoryOrOwnership = React.useCallback(
    (c, user) => resolvePendingFromHistoryOrOwnershipUtil(c, user),
    [],
  );

  const refreshVRFPanel = React.useCallback(() => {
    return refreshVRFPanelUtil(walletAddress, setVRFUIData, buildVRFHistory);
  }, [walletAddress, buildVRFHistory]);

  const checkVRFResolution = React.useCallback(() => {
    return checkVRFResolutionUtil({
      walletAddress,
      contractRef,
      fetchWalletAssets,
      fetchStats,
      fetchREWARDS,
      resolvePendingFromHistoryOrOwnershipFn:
        resolvePendingFromHistoryOrOwnership,
      setVRFPending,
      setIsRedeeming,
      setRedeemMsg,
      refreshVRFPanelFn: refreshVRFPanel,
      setRedeemStartedAt,
    });
  }, [
    walletAddress,
    contractRef,
    fetchWalletAssets,
    fetchStats,
    fetchREWARDS,
    resolvePendingFromHistoryOrOwnership,
    refreshVRFPanel,
    setRedeemStartedAt,
  ]);

  const runPostConnect = React.useCallback(
    (addr) => {
      const tasks = [
        fetchStats(),
        fetchREWARDS(),
        fetchWalletAssets(addr),
        fetchLastMinted(),
        refreshVRFPanel(),
        checkVRFResolution(),
      ];
      Promise.allSettled(tasks).then((results) => {
        results.forEach((res) => {
          if (res.status === "rejected") {
            console.warn("post-connect refresh failed", res.reason);
          }
        });
      });
    },
    [
      fetchStats,
      fetchREWARDS,
      fetchWalletAssets,
      fetchLastMinted,
      refreshVRFPanel,
      checkVRFResolution,
    ],
  );

  const connectMetaMask = React.useCallback(async () => {
    const eth = pickInjectedProvider();
    if (!eth) {
      alert("MetaMask extension is not installed.");
      return;
    }
    try {
      if (eth && eth !== window.ethereum) window.ethereum = eth;
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const addr = accounts?.[0];
      if (!addr) throw new Error("No account returned from wallet.");

      const injectedProvider = getSignerProvider();
      const net = await injectedProvider.getNetwork().catch(() => null);
      if (Number(net?.chainId) !== 80002) {
        await ensureAmoy();
      }

      setWalletAddress(addr);
      resetROProvider();
      contractRef.current = getContract();
      runPostConnect(addr);
    } catch (err) {
      alert("Connection rejected.");
      console.error("connectMetaMask", err);
    }
  }, [runPostConnect]);

  const connectWalletConnect = React.useCallback(async () => {
    if (!import.meta.env.VITE_WC_PROJECT_ID) {
      const injected = pickInjectedProvider();
      if (injected) {
        await connectMetaMask();
        return;
      }
      alert(
        "WalletConnect is not configured. Add VITE_WC_PROJECT_ID to .env.local.",
      );
      return;
    }
    try {
      const { provider, signer } = await connectWithWalletConnect();
      const addr = await signer.getAddress();
      setWalletAddress(addr);
      if (typeof window !== "undefined") window.ethereum = provider;
      resetROProvider();
      contractRef.current = getContract();
      runPostConnect(addr);
    } catch (err) {
      console.error("connectWalletConnect", err);
      alert(err?.message || "WalletConnect failed");
    }
  }, [connectMetaMask, runPostConnect]);

  const {
    performing: mintRedeemPerforming,
    error: mintRedeemError,
    resolveTicketPriceWei,
    mintTicket,
    redeemTicket,
    onVRFRequest,
    onVRFRefresh,
    onVRFCancelPending,
    onVRFUpdateParams,
  } = useMintRedeem({
    walletAddress,
    contractRef,
    getReadOnlyContract,
    getContract,
    ensureAmoy,
    getReaderRO,
    fetchStats,
    fetchREWARDS,
    fetchWalletAssets,
    onRefreshTokenMetaRef,
    refreshVRFPanel,
    checkVRFResolution,
    fetchMyTickets,
    fetchOwnedNFTsViaTransfers,
    preflightRedeemCheck,
    prettyError,
    setMyNFTs,
    isRedeeming,
    VRFPending,
    setIsRedeeming,
    setRedeemMsg,
    setRedeemStartBlock,
    setRedeemStartedAt,
    setPendingTicketId,
    setVRFPending,
    setTopFirstId,
  });

  const actionPerforming = mintRedeemPerforming || claimPerforming;
  const actionError = claimError || mintRedeemError;

  const onVRFOpenExplorer = React.useCallback(
    (hashOrId) => openVRFExplorer(hashOrId, getReadOnlyContract),
    [],
  );

  const fetchChainNowTs = React.useCallback(async () => {
    try {
      const c = contractRef.current || getReadOnlyContract();
      const block = await c.provider.getBlock("latest");
      const ts = Number(block?.timestamp);
      return Number.isFinite(ts) && ts > 0 ? ts : Math.floor(Date.now() / 1000);
    } catch {
      return Math.floor(Date.now() / 1000);
    }
  }, []);

  const fetchCountdownMeta = React.useCallback(async () => {
    try {
      const brl = await getReadOnlyLiquidityContract();

      const epochRaw = await callFirst(brl, [
        "epochStart",
        "weekEpochStart",
        "firstWeekStart",
        "startEpoch",
        "REWARDSEpochStart",
      ]);
      const epochNum =
        epochRaw != null
          ? Number(epochRaw.toString ? epochRaw.toString() : epochRaw)
          : null;
      setEpochStartTs(
        Number.isFinite(epochNum) && epochNum > 0 ? epochNum : null,
      );

      let lastRaw = null;
      if (walletAddress) {
        lastRaw = await callFirst(
          brl,
          ["lastClaim", "lastClaimedAt", "userLastClaim", "claimedAt"],
          [walletAddress],
        );
        if (!lastRaw) {
          const next = await callFirst(
            brl,
            ["nextClaimAt", "userNextClaimAt"],
            [walletAddress],
          );
          if (next) {
            const n =
              Number(next.toString ? next.toString() : next) - 7 * 24 * 60 * 60;
            lastRaw = n > 0 ? n : null;
          }
        }
      }
      const lastNum =
        lastRaw != null
          ? Number(lastRaw.toString ? lastRaw.toString() : lastRaw)
          : null;
      setUserLastClaimTs(
        Number.isFinite(lastNum) && lastNum > 0 ? lastNum : null,
      );
    } catch (e) {
      console.error("fetchCountdownMeta", e);
      setEpochStartTs(null);
      setUserLastClaimTs(null);
    }
  }, [walletAddress, callFirst]);

  const fetchLiveStatus = React.useCallback(async () => {
    try {
      const brl = await getReadOnlyLiquidityContract();
      const main = contractRef.current || getReadOnlyContract();
      const provider = brl.provider;
      const net = await provider.getNetwork();

      let tokenSymbol = "BIGGI";
      try {
        const meta = await callFirst(brl, ["tokenMeta"]);
        if (Array.isArray(meta) && meta[1]) tokenSymbol = meta[1];
        else {
          const tAddr = await callFirst(brl, [
            "tokenAddress",
            "biggi",
            "getToken",
            "getBIGGI",
          ]);
          if (tAddr) {
            const erc20 = new Contract(tAddr, ERC20_MINI, provider);
            tokenSymbol =
              (await erc20.symbol().catch(() => tokenSymbol)) || tokenSymbol;
          }
        }
      } catch {}

      const nativeSymbol = "POL";
      const POLICY =
        (await callFirst(main, ["POLICY", "POLICYAddress"])) || "\u2014";
      const treasury =
        (await callFirst(brl, [
          "treasury",
          "treasuryAddress",
          "getTreasury",
        ])) ||
        (await callFirst(main, ["treasury", "treasuryAddress"])) ||
        "\u2014";
      const reserve =
        (await callFirst(main, ["reserve", "reserveAddress"])) || "\u2014";
      const liquidity = brl.address || "\u2014";

      return {
        nativeSymbol,
        tokenSymbol,
        POLICY,
        treasury,
        reserve,
        liquidity,
        network: net?.name || "unknown",
        chainId: String(net?.chainId ?? ""),
      };
    } catch (e) {
      console.error("fetchLiveStatus", e);
      return {};
    }
  }, [callFirst]);

  // Effects moved to AppCore

  const navOpen = openNavIdx !== null;
  const navAlt = navOpen ? UI_CONST.ICONS[openNavIdx].alt : "";
  const isInfoOpen = navOpen && navAlt === "INFO";
  const isCOLLECTIONOpen = navOpen && navAlt === "COLLECTION";
  const isREWARDSOpen = navOpen && navAlt === "REWARDS";
  const isTokenPanelOpen = navOpen && navAlt === "BIGGI ECOSYSTEM";
  const isUSERPANELOpen = navOpen && navAlt === "USERS";
  const isVRFPanelOpen = navOpen && navAlt === "VRF MINT";
  const isCOMMUNITYCENTEROpen = navOpen && navAlt === "COMMUNITY CENTER";

  const hideExtras =
    navOpen &&
    (navAlt === "COLLECTION" ||
      navAlt === "VRF MINT" ||
      navAlt === "BIGGI ECOSYSTEM" ||
      navAlt === "USERS" ||
      navAlt === "COMMUNITY CENTER");

  const goNextPanel = React.useCallback(() => {
    setOpenNavIdx((idx) => {
      if (idx === null) return 0;
      return (idx + 1) % UI_CONST.ICONS.length;
    });
  }, []);
  const goPrevPanel = React.useCallback(() => {
    setOpenNavIdx((idx) => {
      if (idx === null) return UI_CONST.ICONS.length - 1;
      return (idx - 1 + UI_CONST.ICONS.length) % UI_CONST.ICONS.length;
    });
  }, []);

  useNavHotkeys(navOpen, goNextPanel, goPrevPanel);

  React.useEffect(() => {
    if (navOpen && typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [navOpen]);

  const adminSnapshot = {
    networkLabel: VRFUIData?.network || "EVM",
    contractAddress: contractRef.current?.address,
    paused: null,
    totalSupply: biggiMinted,
    maxSupply,
    ticketPrice,
    REWARDSPool: rewardPool,
    treasury: undefined,
    liquiditySink: undefined,
    token: { address: biggiData?.token?.address },
    dex: { router: biggiData?.router?.routerAddress },
    baseURI: undefined,
    VRF: {
      keyHash: VRFUIData?.params?.keyHash,
      confirmations: VRFUIData?.params?.confirmations,
      numWords: VRFUIData?.params?.numWords,
      callbackGasLimit: VRFUIData?.params?.callbackGasLimit,
      coordinator: undefined,
      subscriptionId: VRFUIData?.subscription?.id,
    },
    blocks: BACKGROUND_NAMES.map((name, i) => ({
      name,
      basePrice: blockPrices[i] ?? 0,
      currentPrice: blockPrices[i] ?? 0,
      minted: blockMintCounts[i] ?? 0,
    })),
    owner: walletAddress || "",
  };

  const frontendInfo = {
    app: "BiggiEyes Frontend",
    react: React.version,
    network: VRFUIData?.network || "unknown",
    wallet: walletAddress || "-",
    minted: biggiMinted,
    ticketsMinted: ticketMinted,
    screen: `${typeof window !== "undefined" ? window.innerWidth : 0}x${typeof window !== "undefined" ? window.innerHeight : 0}`,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    lastRefreshAt: new Date().toLocaleString(),
  };

  return (
    <div className="full-bg">
      <AppCore
        walletAddress={walletAddress}
        VRFPending={VRFPending}
        fetchStats={fetchStats}
        fetchREWARDS={fetchREWARDS}
        fetchWalletAssets={fetchWalletAssets}
        refreshVRFPanel={refreshVRFPanel}
        checkVRFResolution={checkVRFResolution}
        fetchLastMinted={fetchLastMinted}
        fetchCountdownMeta={fetchCountdownMeta}
        unsubRef={unsubRef}
        isTokenPanelOpen={isTokenPanelOpen}
        onRefreshTokenMeta={onRefreshTokenMeta}
        onRefreshRouterInfo={onRefreshRouterInfo}
        onRefreshLiquidityPreview={onRefreshLiquidityPreview}
        onRefreshBUYBACKInfo={onRefreshBUYBACKInfo}
        fetchReserveInfo={fetchReserveInfo}
        fetchTreasuryInfo={fetchTreasuryInfo}
        ZERO_ADDRESS={ZERO_ADDRESS}
        contractRef={contractRef}
        getContract={getContract}
        setWalletAddress={setWalletAddress}
        setMyNFTs={setMyNFTs}
        setDynamicTraitsById={setDynamicTraitsById}
        setVRFPending={setVRFPending}
        setIsRedeeming={setIsRedeeming}
        setRedeemMsg={setRedeemMsg}
        setTopFirstId={setTopFirstId}
        setPendingTicketId={setPendingTicketId}
        setRedeemStartBlock={setRedeemStartBlock}
        setRedeemStartedAt={setRedeemStartedAt}
        redeemStartedAt={redeemStartedAt}
        enrichMetaWithPrices={enrichMetaWithPrices}
        readJsonFromURI={readJsonFromURI}
        resolveImageUrl={resolveImageUrl}
      />
      <MainLayout
        walletAddress={walletAddress}
        connectMetaMask={connectMetaMask}
        connectWalletConnect={connectWalletConnect}
        isRedeeming={isRedeeming}
        VRFPending={VRFPending}
        mintTicket={mintTicket}
        redeemTicket={redeemTicket}
        claimREWARDS={claimREWARDS}
        actionPerforming={actionPerforming}
        actionError={actionError}
        icons={UI_CONST.ICONS}
        setOpenNavIdx={setOpenNavIdx}
        isMobile={isMobile}
        lastMinted={lastMinted}
        biggiMinted={biggiMinted}
        maxSupply={maxSupply}
        ticketMinted={ticketMinted}
        maxTickets={maxTickets}
        ticketPrice={ticketPrice}
        blockMintCounts={blockMintCounts}
        BACKGROUND_NAMES={BACKGROUND_NAMES}
        blockPrices={blockPrices}
        backgroundMintCounts={backgroundMintCounts}
        rewardPool={rewardPool}
        myClaimable={myClaimable}
        myNFTs={myNFTs}
        mintVolumeMatic={mintVolumeMatic}
        epochStartTs={epochStartTs}
        userLastClaimTs={userLastClaimTs}
        fetchChainNowTs={fetchChainNowTs}
        cardsHelpOpen={cardsHelpOpen}
        setCardsHelpOpen={setCardsHelpOpen}
        galleryLoading={galleryLoading}
        galleryNotice={galleryNotice}
        onOpenAdmin={openAdmin}
        isAdmin={isAdmin}
        hideExtras={hideExtras}
        setTopFirstId={setTopFirstId}
        fetchDynamicTraitsFor={fetchDynamicTraitsFor}
        dynamicTraitsById={dynamicTraitsById}
        setZoomImg={setZoomImg}
        redeemMsg={redeemMsg}
        fetchStats={fetchStats}
        fetchREWARDS={fetchREWARDS}
        fetchWalletAssets={fetchWalletAssets}
      />

      <ModalsLayer
        zoomImg={zoomImg}
        setZoomImg={setZoomImg}
        isRedeeming={isRedeeming}
        VRFPending={VRFPending}
        redeemMsg={redeemMsg}
        pendingTicketId={pendingTicketId}
        fetchWalletAssets={fetchWalletAssets}
        fetchStats={fetchStats}
        fetchREWARDS={fetchREWARDS}
        walletAddress={walletAddress}
        isInfoOpen={isInfoOpen}
        setOpenNavIdx={setOpenNavIdx}
        goPrevPanel={goPrevPanel}
        goNextPanel={goNextPanel}
        isMobile={isMobile}
      />

      <React.Suspense fallback={null}>
        <FullscreenPanel
          open={navOpen && !isInfoOpen}
          title={navOpen ? UI_CONST.ICONS[openNavIdx].alt : ""}
          onClose={() => setOpenNavIdx(null)}
          onPrev={goPrevPanel}
          onNext={goNextPanel}
          compact={isMobile}
          containerStyle={
            isREWARDSOpen
              ? {
                  width: "100%",
                  maxWidth: "100%",
                  height: "100%",
                  maxHeight: "100%",
                  borderRadius: 0,
                  padding: 0,
                  background: "transparent",
                  border: "none",
                  boxShadow: "none",
                }
              : isCOLLECTIONOpen ||
                  isTokenPanelOpen ||
                  isUSERPANELOpen ||
                  isVRFPanelOpen ||
                  isCOMMUNITYCENTEROpen
                ? {
                    width: isMobile ? "min(100vw, 96vw)" : "min(1700px, 96vw)",
                    maxHeight: "100%",
                  }
                : undefined
          }
        >
          {navOpen && !isInfoOpen && (
            <NavPanelSwitch
              activeAlt={navAlt}
              modalText={UI_CONST.ICONS[openNavIdx].modalText}
              transparencyData={transparencyData}
              transparencyLoading={transparencyLoading}
              refreshTransparency={refreshTransparency}
              compact={isMobile}
              walletAddress={walletAddress}
              getSignerProvider={getSignerProvider}
              getROProvider={getROProvider}
              myNFTs={myNFTs}
              myClaimable={myClaimable}
              rewardPool={rewardPool}
              claimREWARDS={claimREWARDS}
              blockNames={BACKGROUND_NAMES}
              blockPrices={blockPrices}
              blockMintCounts={blockMintCounts}
              VRFUIData={VRFUIData}
              onVRFRequest={onVRFRequest}
              onVRFRefresh={onVRFRefresh}
              onVRFCancelPending={onVRFCancelPending}
              onVRFUpdateParams={onVRFUpdateParams}
              onVRFOpenExplorer={onVRFOpenExplorer}
              biggiData={biggiData}
              onRefreshTokenMeta={onRefreshTokenMeta}
              onRefreshREWARDS={onRefreshREWARDS}
              onRefreshRouterInfo={onRefreshRouterInfo}
              onRefreshLiquidityPreview={onRefreshLiquidityPreview}
              onRefreshBUYBACKInfo={onRefreshBUYBACKInfo}
              onRefreshPOLICY={onRefreshPOLICY}
              fetchTreasuryInfo={fetchTreasuryInfo}
              fetchReserveInfo={fetchReserveInfo}
              fetchDistributorInfo={fetchDistributorInfo}
              distributorData={distributorData}
              writeFirst={writeFirst}
              getReserve={getReserve}
              getLiquidityContract={getLiquidityContract}
              connectMetaMask={connectMetaMask}
              connectWalletConnect={connectWalletConnect}
              ticketPrice={ticketPrice}
              biggiMinted={biggiMinted}
              maxSupply={maxSupply}
              maxTickets={maxTickets}
              ticketMinted={ticketMinted}
              mintVolumeMatic={mintVolumeMatic}
              mintTicket={mintTicket}
            />
          )}
        </FullscreenPanel>
      </React.Suspense>

      <React.Suspense fallback={null}>
        <AdminPanel
          open={adminOpen && isAdmin}
          onClose={() => setAdminOpen(false)}
          data={{ ...adminSnapshot, frontend: frontendInfo }}
          actions={adminActions}
        />
      </React.Suspense>
      {/* --- Pďż˝idanďż˝ AdminDashboard, aby byl napojenďż˝ --- */}
      <div style={{ display: "none" }}>
        {/* Napojenďż˝ vďż˝ech dďż˝ďż˝ve nepouďż˝ďż˝vanďż˝ch komponent */}
        <AdminDashboard />
        <IconButton src="/images/UI_CONST.ICONS/token.png" alt="Test Icon" onClick={() => {}} />
        <ModalTopbar title="Test Modal" onClose={() => {}} />
        <ExpansionPanel />
        <WalletButton walletAddress="0x1234567890abcdef" onConnect={() => {}} onConnectWC={() => {}} />
        <LoadingOverlay open={false} />
        {/* Dalďż˝ďż˝ napojenďż˝ dalďż˝ďż˝ch 5 komponent */}
        <PinUploader onDone={() => {}} />
        <RedeemFLOW />
        <REWARDSBlockSummary />
        <BiggiButton>Test BiggiButton</BiggiButton>
        <BUYBACKDRIPButton>Test BUYBACKDRIPButton</BUYBACKDRIPButton>
        {/* Dalďż˝ďż˝ napojenďż˝ dalďż˝ďż˝ch 5 komponent */}
        <BUYBACKStabilityChart />
        <DexLiquidityChart />
        <FLOWButton>Test FLOWButton</FLOWButton>
        <LiquidityVaultChart />
        <LMReserveTokenDexButton>Test LMReserveTokenDexButton</LMReserveTokenDexButton>
        {/* Dalďż˝ďż˝ napojenďż˝ dalďż˝ďż˝ch 5 komponent */}
        <POLICYButton>Test POLICYButton</POLICYButton>
        {/* Simulace pouďż˝itďż˝ RechartsCompat */}
        <div style={{ display: "none" }}>{RechartsCompat.AreaChart ? "" : null}</div>
        <SimpleLineChart data={[]} series={[]} />
        <TokenSupplyChart />
        {/* Simulace pouďż˝itďż˝ adresďż˝ďż˝e ADDR */}
        <div style={{ display: "none" }}>
          {/* Simulace pouďż˝itďż˝ constants/block.js */}
          {BLOCK_CONST.DEFAULT_BLOCKS?.length}
          {/* Simulace pouďż˝itďż˝ constants/blockImages.js */}
          {Array.isArray(BLOCK_IMAGES.ORANGE) ? BLOCK_IMAGES.ORANGE[0] : null}
          {/* Simulace pouďż˝itďż˝ constants/blocksimages.js */}
          {BLOCKSIMAGES ? "blocksimages loaded" : null}
          {/* Simulace pouďż˝itďż˝ constants/ui.js */}
          {UI_CONST.ICONS?.[0]?.alt}
          {/* Simulace pouďż˝itďż˝ Device.js hookďż˝ */}
          {typeof DeviceHOOKS.useIsMobile === "function" ? "Device ok" : null}
        </div>
      </div>
      {/* Importy pro dalďż˝ďż˝ komponenty */}
      {/* eslint-disable-next-line */}
      {/* @ts-ignore */}
    </div>
  );
}

export default App;













