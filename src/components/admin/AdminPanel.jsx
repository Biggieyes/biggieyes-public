// src/components/admin/AdminPanel.jsx
import * as React from "react";
import {
  BrowserProvider,
  Contract,
  formatEther,
  parseEther,
  isAddress,
} from "ethers";
import { ADDR, CORE_CHAPTERS } from "@/shared/utils/addresses.js";
import { ensurePolygon, getROProvider } from "@/shared/utils/contract";
import {
  assertAdminSigner,
  getAdminAccessState,
  POLYGON_MAINNET_CHAIN_ID,
} from "@/shared/utils/adminAccess.js";
import { BiggiCommunityCenter } from "@/config/abi/index.js";
import AdminDashboard from "@/components/AdminDashboard";
import {
  fetchCommunityPolls,
  submitCommunityPollAdminAction,
} from "@/shared/services/communityVotingApi.js";
import { supabase, supabaseReady } from "../../services/chatClient";
import "./AdminPanel.css";
import "../../styles/panel-buttons.css";

const COMMUNITY_CENTER_ABI = Array.isArray(BiggiCommunityCenter)
  ? BiggiCommunityCenter
  : [];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const V2_PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
];
const CHAT_API_BASE = import.meta.env.VITE_CHAT_API_BASE || "";
const CHAT_API_TIMEOUT_MS = (() => {
  const parsed = Number(
    import.meta.env.VITE_CHAT_API_TIMEOUT_MS ||
      import.meta.env.VITE_API_TIMEOUT_MS,
  );
  if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  return 12_000;
})();

function buildChatApiUrl(path) {
  const safePath = (() => {
    if (!path) return "";
    if (path.startsWith("/admin/"))
      return `/admin-${path.slice("/admin/".length)}`;
    return path;
  })();
  if (!CHAT_API_BASE) return `/api${safePath}`;
  if (CHAT_API_BASE.includes("/.netlify/functions"))
    return `${CHAT_API_BASE}${safePath}`;
  return `${CHAT_API_BASE}/api${safePath}`;
}

async function fetchJsonWithTimeout(
  url,
  { timeoutMs = CHAT_API_TIMEOUT_MS, ...options } = {},
) {
  const ms = Number.isFinite(Number(timeoutMs))
    ? Math.max(0, Math.trunc(Number(timeoutMs)))
    : 0;
  const controller =
    typeof AbortController !== "undefined" && ms > 0
      ? new AbortController()
      : null;
  const timer = controller ? setTimeout(() => controller.abort(), ms) : null;

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller?.signal,
      cache: "no-store",
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json?.error || json?.message || "Request failed");
    }
    return json;
  } catch (error) {
    if (error?.name === "AbortError" && ms > 0) {
      throw new Error(`Endpoint timeout after ${ms} ms`);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function resolveCOMMUNITYCENTERAddress() {
  const candidates = [
    ADDR?.COMMUNITY_CENTER,
    ADDR?.COMMUNITYCENTER,
    ADDR?.COMMUNITY,
  ];
  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      /^0x[0-9a-fA-F]{40}$/.test(candidate) &&
      candidate !== ZERO_ADDRESS
    ) {
      return candidate;
    }
  }
  return null;
}

export default function AdminPanel({
  open,
  onClose,
  data = {},
  actions: actionsInput = {},
}) {
  const C = {
    y: "#FFE800",
    line: "rgba(255,255,255,.12)",
    text: "#f6f7fb",
    dim: "#cfd2db",
  };

  // ---- Local UI state ----
  const [baseURI, setBaseURI] = React.useState("");
  const [pauseFlag, setPauseFlag] = React.useState(false);
  const [ticketPrice, setTicketPrice] = React.useState("");
  const [blockIdx, setBlockIdx] = React.useState(""); // 0..9
  const [blockBasePrice, setBlockBasePrice] = React.useState(""); // number
  const [VRF, setVRF] = React.useState({
    keyHash: data?.VRF?.keyHash || "",
    confirmations: data?.VRF?.confirmations ?? 3,
    numWords: data?.VRF?.numWords ?? 1,
    callbackGasLimit: data?.VRF?.callbackGasLimit ?? 300000,
    coordinator: data?.VRF?.coordinator || "",
    subscriptionId: data?.VRF?.subscriptionId || "",
  });
  const [treasury, setTreasury] = React.useState(data?.treasury || "");
  const [liquiditySink, setLiquiditySink] = React.useState(
    data?.liquiditySink || "",
  );
  const [tokenAddress, setTokenAddress] = React.useState(
    data?.token?.address || "",
  );
  const [routerAddress, setRouterAddress] = React.useState(
    data?.dex?.router || "",
  );

  // ===== NEW: Liquidity controls =====
  const [liqRecipient, setLiqRecipient] = React.useState("");
  const [lpUseBps, setLpUseBps] = React.useState("");
  const [txDeadline, setTxDeadline] = React.useState(""); // seconds
  const [swapSlip, setSwapSlip] = React.useState(""); // bps
  const [lpSlip, setLpSlip] = React.useState(""); // bps
  const [swapPath, setSwapPath] = React.useState(""); // "WNATIVE,token,...,BIGGI"
  const [minOut, setMinOut] = React.useState(""); // BIGGI minOut (raw or human, action handles parse)
  const [nativeAmt, setNativeAmt] = React.useState(""); // ETH/POL amount (for BUYBACKToTreasury)
  const [biggiAmt, setBiggiAmt] = React.useState(""); // BIGGI amount for addLiquidityFromBalances
  const [bootToken, setBootToken] = React.useState(""); // token amount for bootstrap
  const [bootEth, setBootEth] = React.useState(""); // native amount for bootstrap
  const [routeBiggiAmt, setRouteBiggiAmt] = React.useState(""); // route to treasury amount

  // ===== NEW: POLICY controls =====
  // Splits
  const [alphaBUYBACK, setAlphaBUYBACK] = React.useState(""); // bps
  const [betaBurn, setBetaBurn] = React.useState(""); // bps
  const [gammaStaking, setGammaStaking] = React.useState(""); // bps
  // Guards
  const [gSwapSlip, setGSwapSlip] = React.useState("");
  const [gLpSlip, setGLpSlip] = React.useState("");
  const [gDeadline, setGDeadline] = React.useState("");
  const [gCooldown, setGCooldown] = React.useState("");
  const [gEpsBand, setGEpsBand] = React.useState("");
  const [gTwapWindow, setGTwapWindow] = React.useState("");
  const [gDailyCap, setGDailyCap] = React.useState("");
  // Pauses
  const [pauseBUYBACKs, setPauseBUYBACKs] = React.useState(false);
  const [pauseRefills, setPauseRefills] = React.useState(false);
  const [pauseLpAdds, setPauseLpAdds] = React.useState(false);
  const [pauseEoc, setPauseEoc] = React.useState(false);
  // Operators
  const [opAddress, setOpAddress] = React.useState("");
  const [opAllowed, setOpAllowed] = React.useState(false);
  // Daily quota test (optional)
  const [dailyConsumeAmt, setDailyConsumeAmt] = React.useState("");

  // Community Center event editing
  const [eventId, setEventId] = React.useState("");
  const [eventTitle, setEventTitle] = React.useState("");
  // Stored as `ipfsHash` on-chain; can be `ipfs://...` or any short descriptor.
  const [eventIpfs, setEventIpfs] = React.useState("");
  const [eventDescription, setEventDescription] = React.useState("");
  const [eventImage, setEventImage] = React.useState("");
  const [eventStart, setEventStart] = React.useState("");
  const [eventEnd, setEventEnd] = React.useState("");
  const [eventTotalPrize, setEventTotalPrize] = React.useState("");
  const [eventWinners, setEventWinners] = React.useState("");
  const [eventAmounts, setEventAmounts] = React.useState("");
  const [communityPollId, setCommunityPollId] = React.useState("");
  const [communityPollTitle, setCommunityPollTitle] = React.useState("");
  const [communityPollDescription, setCommunityPollDescription] =
    React.useState("");
  const [communityPollEventId, setCommunityPollEventId] = React.useState("");
  const [communityPollStartsAt, setCommunityPollStartsAt] = React.useState("");
  const [communityPollEndsAt, setCommunityPollEndsAt] = React.useState("");
  const [communityPollOptions, setCommunityPollOptions] = React.useState("");
  const [communityPolls, setCommunityPolls] = React.useState([]);
  const [communityPollsError, setCommunityPollsError] = React.useState("");
  const [communityOwner, setCommunityOwner] = React.useState("");
  const [communityDistributor, setCommunityDistributor] = React.useState("");
  const [communityPoolBalance, setCommunityPoolBalance] = React.useState("");
  const [communityTotalLocked, setCommunityTotalLocked] = React.useState("");
  const [communityContractBalance, setCommunityContractBalance] =
    React.useState("");
  const [communityNextEventId, setCommunityNextEventId] = React.useState("");
  const [communityPaused, setCommunityPaused] = React.useState(false);
  const [communityDistributorInput, setCommunityDistributorInput] =
    React.useState("");
  const [communityDepositAmount, setCommunityDepositAmount] =
    React.useState("");
  const [communityRescueTo, setCommunityRescueTo] = React.useState("");
  const [communityRescueAmount, setCommunityRescueAmount] = React.useState("");
  const [communityEmergencyTo, setCommunityEmergencyTo] = React.useState("");

  // NFT REWARDS admin (manual + mystery)
  const [nftMainContract, setNftMainContract] = React.useState("");
  const [nftVRFRouter, setNftVRFRouter] = React.useState("");
  const [nftManualWinner, setNftManualWinner] = React.useState("");
  const [nftManualUri, setNftManualUri] = React.useState("");
  const [nftMysteryUris, setNftMysteryUris] = React.useState("");
  const [nftMysteryEligible, setNftMysteryEligible] = React.useState("");
  const [nftMysteryEventId, setNftMysteryEventId] = React.useState("");
  const [nftLastEventId, setNftLastEventId] = React.useState("");
  const [nftLastRewardId, setNftLastRewardId] = React.useState("");
  const [nftLastRequestId, setNftLastRequestId] = React.useState("");

  const [activeTab, setActiveTab] = React.useState("core");
  const [chatMessages, setChatMessages] = React.useState([]);
  const [chatRules, setChatRules] = React.useState("");
  const [chatRulesDraft, setChatRulesDraft] = React.useState("");
  const [chatLoading, setChatLoading] = React.useState(false);
  const [chatError, setChatError] = React.useState("");
  const [chatMessageId, setChatMessageId] = React.useState("");
  const [chatNewContent, setChatNewContent] = React.useState("");
  const [chatAction, setChatAction] = React.useState("soft-delete");
  const [healthData, setHealthData] = React.useState({
    rpc: null,
    contracts: [],
    dex: null,
  });
  const [healthLoading, setHealthLoading] = React.useState(false);
  const [healthError, setHealthError] = React.useState("");
  const [walletChainId, setWalletChainId] = React.useState(null);
  const actions = React.useMemo(
    () =>
      new Proxy(actionsInput || {}, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);
          if (typeof value === "function") return value;
          return () => {
            throw new Error(
              `Action "${String(prop)}" is unavailable in this build`,
            );
          };
        },
      }),
    [actionsInput],
  );

  const hasAction = React.useCallback(
    (name) => typeof actionsInput?.[name] === "function",
    [actionsInput],
  );
  const hasAnyAction = React.useCallback(
    (names) => names.some((name) => hasAction(name)),
    [hasAction],
  );

  const coreAvailability = React.useMemo(
    () => ({
      pause: hasAction("setPaused"),
      baseURI: hasAction("setBaseURI"),
      ticketPrice: hasAction("setTicketPrice"),
      blockBasePrice: hasAction("setBlockBasePrice"),
      vrf: hasAction("setVRFParams"),
      treasury: hasAction("setTreasury"),
      liquiditySink: hasAction("setLiquiditySink"),
      tokenAddress: hasAction("setTokenAddress"),
      router: hasAction("setRouter"),
      withdrawNative: hasAction("withdrawNative"),
      withdrawToken: hasAction("withdrawToken"),
      sweepDust: hasAction("sweepDust"),
    }),
    [hasAction],
  );
  const hasCoreSetters = React.useMemo(
    () => Object.values(coreAvailability).some(Boolean),
    [coreAvailability],
  );
  const liquidityAvailable = React.useMemo(
    () =>
      hasAnyAction([
        "liq_setLiquidityRecipient",
        "liq_setLpUseBalanceBps",
        "liq_setSwapSlippageBps",
        "liq_setLpAddSlippageBps",
        "liq_setTxDeadline",
        "liq_setSwapPath",
        "liq_clearSwapPath",
        "liq_BUYBACKToTreasury",
        "liq_BUYBACKAllToTreasury",
        "liq_addLiquidityFromBalances",
        "liq_bootstrapLiquidity",
        "liq_routeBiggiToTreasury",
      ]),
    [hasAnyAction],
  );
  const policyAvailable = React.useMemo(
    () =>
      hasAnyAction([
        "pol_setSplits",
        "pol_setGuards",
        "pol_setPauses",
        "pol_setOperator",
        "pol_consumeDaily",
        "pol_resetDailyCounter",
      ]),
    [hasAnyAction],
  );
  const nftAvailable = React.useMemo(
    () =>
      hasAnyAction([
        "nft_setMainContract",
        "nft_setVRFRouter",
        "nft_createManualReward",
        "nft_createMysteryEvent",
        "nft_requestMysteryRandom",
      ]),
    [hasAnyAction],
  );
  const frontendAvailable = Boolean(data?.frontend);
  const ownerWallet = String(data?.frontend?.wallet || "");
  const expectedChainId = Number(data?.chainId || ADDR.CHAIN_ID || 137);
  const expectedOwner = String(
    data?.owner || ADDR.EXPECT_OWNER || ADDR.OWNER || "",
  );
  const adminAccess = React.useMemo(
    () =>
      getAdminAccessState({
        walletAddress: ownerWallet,
        ownerAddress: expectedOwner,
        chainId: walletChainId,
        expectedChainId,
      }),
    [expectedChainId, expectedOwner, ownerWallet, walletChainId],
  );

  React.useEffect(() => {
    if (!open || typeof window === "undefined" || !window.ethereum?.request) {
      return undefined;
    }

    let cancelled = false;
    const readChainId = async () => {
      const value = await window.ethereum
        .request({ method: "eth_chainId" })
        .catch(() => null);
      if (!cancelled) {
        setWalletChainId(
          typeof value === "string"
            ? Number.parseInt(value, 16)
            : Number(value),
        );
      }
    };
    const onChainChanged = (value) => {
      setWalletChainId(
        typeof value === "string" ? Number.parseInt(value, 16) : Number(value),
      );
    };

    readChainId();
    window.ethereum.on?.("chainChanged", onChainChanged);
    return () => {
      cancelled = true;
      window.ethereum.removeListener?.("chainChanged", onChainChanged);
    };
  }, [open]);

  // pending stavy pro tlačítka + status info
  const [pending, setPending] = React.useState({});
  const [statusMsg, setStatusMsg] = React.useState("");
  React.useEffect(() => {
    if (!open) return;

    setBaseURI(String(data?.baseURI || ""));
    setPauseFlag(Boolean(data?.paused));
    setTicketPrice(
      data?.ticketPrice == null || data?.ticketPrice === ""
        ? ""
        : String(data.ticketPrice),
    );
    setTreasury(String(data?.treasury || ""));
    setLiquiditySink(String(data?.liquiditySink || ""));
    setTokenAddress(String(data?.token?.address || ""));
    setRouterAddress(String(data?.dex?.router || ""));
    setVRF({
      keyHash: data?.VRF?.keyHash || "",
      confirmations: data?.VRF?.confirmations ?? 3,
      numWords: data?.VRF?.numWords ?? 1,
      callbackGasLimit: data?.VRF?.callbackGasLimit ?? 300000,
      coordinator: data?.VRF?.coordinator || "",
      subscriptionId: data?.VRF?.subscriptionId || "",
    });
    setNftMainContract(String(data?.nft?.mainContract || ""));
    setNftVRFRouter(String(data?.nft?.vrfRouter || data?.VRF?.router || ""));
  }, [
    open,
    data?.baseURI,
    data?.paused,
    data?.ticketPrice,
    data?.treasury,
    data?.liquiditySink,
    data?.token?.address,
    data?.dex?.router,
    data?.VRF?.keyHash,
    data?.VRF?.confirmations,
    data?.VRF?.numWords,
    data?.VRF?.callbackGasLimit,
    data?.VRF?.coordinator,
    data?.VRF?.subscriptionId,
    data?.VRF?.router,
    data?.nft?.mainContract,
    data?.nft?.vrfRouter,
  ]);

  // --- Handlers helpers ---
  const run = React.useCallback(
    async (key, fn) => {
    if (!fn) return;
    try {
      setPending((p) => ({ ...p, [key]: true }));
      setStatusMsg("");
      await fn();
      setStatusMsg("✅ Done");
      // auto-refresh, pokud existuje akce refresh
      if (hasAction("refresh")) {
        await actions.refresh();
        setStatusMsg("✅ Done & refreshed");
      }
    } catch (e) {
      setStatusMsg(`❌ ${shortErr(e)}`);
    } finally {
      setPending((p) => ({ ...p, [key]: false }));
      // smazat hlášku po chvíli
      setTimeout(() => setStatusMsg(""), 3500);
    }
    },
    [actions, hasAction],
  );

  const submitVRFParams = React.useCallback(async () => {
    const keyHash = String(VRF.keyHash || "").trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(keyHash)) {
      throw new Error("VRF key hash must be a 32-byte hex value");
    }

    const parsePositiveUint = (value, label, max = null) => {
      const raw = String(value ?? "").trim();
      if (!/^\d+$/.test(raw) || BigInt(raw) === 0n) {
        throw new Error(`${label} must be a positive integer`);
      }
      const parsed = BigInt(raw);
      if (max != null && parsed > max) {
        throw new Error(`${label} exceeds the contract type limit`);
      }
      return parsed.toString();
  };

    await actions.setVRFParams({
      ...VRF,
      keyHash,
      subscriptionId: parsePositiveUint(VRF.subscriptionId, "Subscription ID"),
      callbackGasLimit: Number(
        parsePositiveUint(
          VRF.callbackGasLimit,
          "Callback gas limit",
          0xffffffffn,
        ),
      ),
      confirmations: Number(
        parsePositiveUint(VRF.confirmations, "Confirmations", 0xffffn),
      ),
      numWords: Number(
        parsePositiveUint(VRF.numWords, "Num words", 0xffffffffn),
      ),
    });
  }, [VRF, actions]);

  const communityAddress = React.useMemo(
    () => resolveCOMMUNITYCENTERAddress(),
    [],
  );
  const communityAvailable = Boolean(
    communityAddress && COMMUNITY_CENTER_ABI.length,
  );
  const communityAccess = React.useMemo(
    () =>
      getAdminAccessState({
        walletAddress: ownerWallet,
        ownerAddress: communityOwner || expectedOwner,
        chainId: walletChainId,
        expectedChainId,
      }),
    [
      communityOwner,
      expectedChainId,
      expectedOwner,
      ownerWallet,
      walletChainId,
    ],
  );
  const canWriteCommunity = communityAvailable && communityAccess.canWrite;

  const getVerifiedAdminSigner = React.useCallback(
    async (ownerAddress = expectedOwner) => {
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("Wallet provider not found");
      }
      await ensurePolygon(window.ethereum);
      await window.ethereum.request?.({ method: "eth_requestAccounts" });
      const provider = new BrowserProvider(window.ethereum, "any");
      const verified = await assertAdminSigner({
        provider,
        ownerAddress,
        expectedChainId,
      });
      setWalletChainId(verified.chainId);
      return verified;
    },
    [expectedChainId, expectedOwner],
  );

  const getCommunityContract = React.useCallback(
    async (rw = false) => {
      if (!communityAddress)
        throw new Error("Community Center address not configured");
      if (!COMMUNITY_CENTER_ABI.length)
        throw new Error("Community Center ABI missing");

      if (rw) {
        const { signer } = await getVerifiedAdminSigner(
          communityOwner || expectedOwner,
        );
        return new Contract(communityAddress, COMMUNITY_CENTER_ABI, signer);
      }

      let provider = null;
      try {
        provider = getROProvider();
      } catch {}
      if (!provider && typeof window !== "undefined" && window.ethereum) {
        provider = new BrowserProvider(window.ethereum, "any");
      }
      if (!provider) throw new Error("Read provider unavailable");
      return new Contract(communityAddress, COMMUNITY_CENTER_ABI, provider);
    },
    [communityAddress, communityOwner, expectedOwner, getVerifiedAdminSigner],
  );

  const bnToString = (value) => {
    if (value == null) return "";
    try {
      return BigInt(value).toString();
    } catch {
      return String(value ?? "");
    }
  };

  const parseUintField = (value, label, required = false) => {
    const raw = String(value ?? "").trim();
    if (!raw) {
      if (required) throw new Error(`${label} is required`);
      return "0";
    }
    if (!/^\d+$/.test(raw)) {
      throw new Error(`${label} must be a non-negative integer`);
    }
    return BigInt(raw).toString();
  };

  const parseDepositField = (value) => {
    if (value === "" || value == null) {
      return BigInt(0);
    }
    const raw = String(value).trim();
    if (!/^\d+(\.\d+)?$/.test(raw)) {
      throw new Error("Deposit must be a non-negative number");
    }
    return parseEther(raw);
  };

  const formatPolDisplay = (value) => {
    try {
      const next = Number(formatEther(value ?? 0n));
      if (!Number.isFinite(next)) return "--";
      if (next === 0) return "0 POL";
      if (next >= 1000) {
        return `${next.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })} POL`;
      }
      if (next >= 1) return `${next.toFixed(2)} POL`;
      return `${next.toFixed(4)} POL`;
    } catch {
      return "--";
    }
  };

  const syncCommunityOverview = React.useCallback(async () => {
    if (!communityAvailable) return;
    const contract = await getCommunityContract(false);
    let provider = null;
    try {
      provider = contract?.runner?.provider || getROProvider();
    } catch {}

    const [
      owner,
      distributor,
      poolBalance,
      totalLocked,
      paused,
      nextEventId,
      contractBalance,
    ] = await Promise.all([
      contract.owner().catch(() => ZERO_ADDRESS),
      contract.distributor().catch(() => ZERO_ADDRESS),
      contract.poolBalance().catch(() => 0n),
      contract.totalLocked().catch(() => 0n),
      contract.paused().catch(() => false),
      contract.nextEventId().catch(() => 0n),
      provider?.getBalance
        ? provider.getBalance(communityAddress).catch(() => 0n)
        : Promise.resolve(0n),
    ]);

    setCommunityOwner(String(owner || ""));
    setCommunityDistributor(String(distributor || ""));
    setCommunityPoolBalance(formatPolDisplay(poolBalance));
    setCommunityTotalLocked(formatPolDisplay(totalLocked));
    setCommunityContractBalance(formatPolDisplay(contractBalance));
    setCommunityNextEventId(bnToString(nextEventId));
    setCommunityPaused(Boolean(paused));
    setCommunityDistributorInput((prev) =>
      String(prev || "").trim() ? prev : String(distributor || ""),
    );
    setCommunityRescueTo((prev) =>
      String(prev || "").trim() ? prev : String(owner || ""),
    );
    setCommunityEmergencyTo((prev) =>
      String(prev || "").trim() ? prev : String(owner || ""),
    );
  }, [communityAddress, communityAvailable, getCommunityContract]);

  const loadCommunityOverview = () =>
    run("community_overview", async () => {
      await syncCommunityOverview();
    });

  React.useEffect(() => {
    if (!open || activeTab !== "community") return;
    if (communityAvailable) syncCommunityOverview().catch(() => {});
  }, [activeTab, communityAvailable, open, syncCommunityOverview]);

  const clearCommunityEventForm = () => {
    setEventTitle("");
    setEventIpfs("");
    setEventDescription("");
    setEventImage("");
    setEventStart("");
    setEventEnd("");
    setEventTotalPrize("");
    setEventWinners("");
    setEventAmounts("");
  };

  const parseCommunityPollDate = (value, label) => {
    const raw = String(value || "").trim();
    if (!raw) throw new Error(`${label} is required`);
    const asNumber = Number(raw);
    const date =
      Number.isFinite(asNumber) && raw !== ""
        ? new Date(raw.length >= 13 ? asNumber : asNumber * 1000)
        : new Date(raw);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`${label} is invalid`);
    }
    return date.toISOString();
  };

  const toDateTimeLocalValue = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (next) => String(next).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const clearCommunityPollForm = () => {
    setCommunityPollId("");
    setCommunityPollTitle("");
    setCommunityPollDescription("");
    setCommunityPollEventId("");
    setCommunityPollStartsAt("");
    setCommunityPollEndsAt("");
    setCommunityPollOptions("");
  };

  const loadCommunityPolls = React.useCallback(async () => {
    setCommunityPollsError("");
    try {
      const json = await fetchCommunityPolls({ includeAll: true });
      setCommunityPolls(Array.isArray(json?.polls) ? json.polls : []);
    } catch (error) {
      console.error("Community polls load failed", error);
      setCommunityPolls([]);
      setCommunityPollsError(
        error?.message || "Failed to load community polls.",
      );
    }
  }, []);

  React.useEffect(() => {
    if (!open || activeTab !== "community") return;
    loadCommunityPolls().catch(() => {});
  }, [activeTab, loadCommunityPolls, open]);

  const loadCommunityPollIntoForm = React.useCallback((poll) => {
    setCommunityPollId(String(poll?.id || "").trim());
    setCommunityPollTitle(String(poll?.title || "").trim());
    setCommunityPollDescription(String(poll?.description || "").trim());
    setCommunityPollEventId(
      poll?.linkedEventId == null ? "" : String(poll.linkedEventId),
    );
    setCommunityPollStartsAt(toDateTimeLocalValue(poll?.startsAt));
    setCommunityPollEndsAt(toDateTimeLocalValue(poll?.endsAt));
    setCommunityPollOptions(
      (Array.isArray(poll?.options) ? poll.options : [])
        .map((option) => String(option?.label || "").trim())
        .filter(Boolean)
        .join("\n"),
    );
  }, []);

  const signCommunityAdminPayload = async (payload) => {
    const { signer, signerAddress: address } =
      await getVerifiedAdminSigner(expectedOwner);
    const signature = await signer.signMessage(`community-admin|${payload}`);
    return { address, signature };
  };

  const saveCommunityPoll = () =>
    run("community_poll_save", async () => {
      const title = String(communityPollTitle || "").trim();
      if (!title) throw new Error("Poll title is required");

      const options = splitListInput(communityPollOptions);
      if (options.length < 2) {
        throw new Error("At least two vote options are required");
      }

      const startsAt = parseCommunityPollDate(
        communityPollStartsAt,
        "Poll start",
      );
      const endsAt = parseCommunityPollDate(communityPollEndsAt, "Poll end");
      if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        throw new Error("Poll end must be later than poll start");
      }

      const linkedEventIdRaw = String(communityPollEventId || "").trim();
      if (linkedEventIdRaw && !/^\d+$/.test(linkedEventIdRaw)) {
        throw new Error("Linked event ID must be a non-negative integer");
      }

      const payload = JSON.stringify({
        action: "upsert",
        timestamp: Date.now(),
        poll: {
          ...(String(communityPollId || "").trim()
            ? { id: String(communityPollId || "").trim() }
            : {}),
          title,
          description: String(communityPollDescription || "").trim(),
          linkedEventId: linkedEventIdRaw || null,
          startsAt,
          endsAt,
          options,
        },
      });

      const { address, signature } = await signCommunityAdminPayload(payload);
      const json = await submitCommunityPollAdminAction({
        address,
        payload,
        signature,
      });

      if (json?.poll?.id) {
        loadCommunityPollIntoForm(json.poll);
      }
      await loadCommunityPolls();
    });

  const closeCommunityPoll = (pollId) =>
    run(`community_poll_close_${pollId}`, async () => {
      const safePollId = String(pollId || "").trim();
      if (!safePollId) throw new Error("Poll ID is required");

      const payload = JSON.stringify({
        action: "close",
        timestamp: Date.now(),
        pollId: safePollId,
      });

      const { address, signature } = await signCommunityAdminPayload(payload);
      await submitCommunityPollAdminAction({
        address,
        payload,
        signature,
      });
      await loadCommunityPolls();
    });

  const loadCommunityEvent = () =>
    run("community_loadEvent", async () => {
      const contract = await getCommunityContract(false);
      const id = parseUintField(eventId, "Event ID", true);
      const [ev, winnersTuple] = await Promise.all([
        contract.getEvent(id),
        typeof contract.getEventWinners === "function"
          ? contract.getEventWinners(id).catch(() => null)
          : Promise.resolve(null),
      ]);

      const rawMetadata = String(ev?.ipfsHash ?? ev?.ipfs ?? "").trim();
      const inlineMetadata = (() => {
        if (!rawMetadata || !rawMetadata.startsWith("{")) return null;
        try {
          const parsed = JSON.parse(rawMetadata);
          return parsed && typeof parsed === "object" ? parsed : null;
        } catch {
          return null;
        }
      })();

      setEventTitle(String(ev?.title ?? "").trim());
      setEventIpfs(inlineMetadata ? "" : rawMetadata);
      setEventDescription(String(inlineMetadata?.description ?? "").trim());
      setEventImage(String(inlineMetadata?.image ?? "").trim());
      setEventStart(bnToString(ev?.start));
      setEventEnd(bnToString(ev?.end));

      const totalPrizeBn = ev?.totalPrize_ ?? ev?.totalPrize ?? null;
      setEventTotalPrize(totalPrizeBn != null ? formatEther(totalPrizeBn) : "");

      if (Array.isArray(winnersTuple) && winnersTuple.length >= 2) {
        const [winnersRaw, amountsRaw] = winnersTuple;
        const winners = Array.isArray(winnersRaw) ? winnersRaw : [];
        const amounts = Array.isArray(amountsRaw) ? amountsRaw : [];
        setEventWinners(winners.join("\n"));
        setEventAmounts(
          amounts
            .map((amt) => {
              try {
                return formatEther(amt ?? 0);
              } catch {
                return "";
              }
            })
            .filter(Boolean)
            .join("\n"),
        );
      } else {
        setEventWinners("");
        setEventAmounts("");
      }
    });

  const createCommunityEvent = () =>
    run("community_createEvent", async () => {
      if (!communityAvailable)
        throw new Error("Community Center contract not available");
      const contract = await getCommunityContract(true);
      const title = eventTitle.trim();
      if (!title) throw new Error("Event title is required");

      const description = String(eventDescription || "").trim();
      const image = String(eventImage || "").trim();
      const ipfsInput = String(eventIpfs || "").trim();
      const ipfsHash =
        ipfsInput ||
        (description || image
          ? JSON.stringify({
              title,
              ...(description ? { description } : {}),
              ...(image ? { image } : {}),
            })
          : "");
      const start = parseUintField(eventStart, "Start timestamp");
      const end = parseUintField(eventEnd, "End timestamp");

      const winners = parseAddressListInput(eventWinners);
      if (!winners.length) {
        throw new Error("At least one winner address is required");
      }
      if (winners.some((winner) => winner.toLowerCase() === ZERO_ADDRESS)) {
        throw new Error("Winner address cannot be the zero address");
      }
      if (
        new Set(winners.map((winner) => winner.toLowerCase())).size !==
        winners.length
      ) {
        throw new Error("Winner addresses must be unique");
      }
      const amountsText = splitListInput(eventAmounts);
      const amounts = amountsText.map((amt) => parseDepositField(amt));
      if (amounts.length !== winners.length) {
        throw new Error("Winners and amounts must have the same item count");
      }
      if (amounts.some((amount) => amount <= 0n)) {
        throw new Error("Every winner amount must be greater than zero");
      }
      if (BigInt(end) <= BigInt(start)) {
        throw new Error("End timestamp must be greater than start timestamp");
      }

      const amountsTotal = amounts.reduce((acc, amount) => acc + amount, 0n);
      const totalPrize =
        String(eventTotalPrize || "").trim() !== ""
          ? parseDepositField(eventTotalPrize)
          : amountsTotal;
      if (totalPrize !== amountsTotal) {
        throw new Error("Total prize must equal the sum of winner amounts");
      }

      const args = [title, ipfsHash, start, end, totalPrize, winners, amounts];
      const nextId = await contract.createEvent.staticCall(...args);
      const tx = await contract.createEvent(...args);
      await tx.wait();
      setEventId(nextId.toString());
      await syncCommunityOverview();
    });

  const setCommunityDistributorAddress = () =>
    run("community_setDistributor", async () => {
      if (!communityAvailable)
        throw new Error("Community Center contract not available");
      const addr = String(communityDistributorInput || "").trim();
      if (!isAddress(addr)) throw new Error("Distributor address is invalid");
      const contract = await getCommunityContract(true);
      const tx = await contract.setDistributor(addr);
      await tx.wait();
      await syncCommunityOverview();
    });

  const depositCommunityPool = () =>
    run("community_ownerDeposit", async () => {
      if (!communityAvailable)
        throw new Error("Community Center contract not available");
      const value = parseDepositField(communityDepositAmount);
      if (value <= 0n)
        throw new Error("Deposit amount must be greater than zero");
      const contract = await getCommunityContract(true);
      const tx = await contract.ownerDeposit({ value });
      await tx.wait();
      setCommunityDepositAmount("");
      await syncCommunityOverview();
    });

  const rescueCommunityPool = () =>
    run("community_rescuePool", async () => {
      if (!communityAvailable)
        throw new Error("Community Center contract not available");
      const to = String(communityRescueTo || "").trim();
      if (!isAddress(to)) throw new Error("Rescue target address is invalid");
      const value = parseDepositField(communityRescueAmount);
      if (value <= 0n)
        throw new Error("Rescue amount must be greater than zero");
      const contract = await getCommunityContract(true);
      const tx = await contract.rescuePool(to, value);
      await tx.wait();
      await syncCommunityOverview();
    });

  const toggleCommunityPause = () =>
    run("community_pauseToggle", async () => {
      if (!communityAvailable)
        throw new Error("Community Center contract not available");
      const contract = await getCommunityContract(true);
      const tx = communityPaused
        ? await contract.unpause()
        : await contract.pause();
      await tx.wait();
      await syncCommunityOverview();
    });

  const emergencyWithdrawCommunity = () =>
    run("community_emergencyWithdraw", async () => {
      if (!communityAvailable)
        throw new Error("Community Center contract not available");
      const to = String(communityEmergencyTo || "").trim();
      if (!isAddress(to))
        throw new Error("Emergency withdraw target is invalid");
      const contract = await getCommunityContract(true);
      const tx = await contract.emergencyWithdraw(to);
      await tx.wait();
      await syncCommunityOverview();
    });

  const splitListInput = (value) =>
    String(value || "")
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const parseAddressListInput = (value) => {
    const items = splitListInput(value);
    const bad = items.find((addr) => !isAddress(addr));
    if (bad) throw new Error(`Invalid address: ${bad}`);
    return items;
  };

  const applyNftMainContract = () =>
    run("nft_setMain", async () => {
      const addr = nftMainContract.trim();
      if (!isAddress(addr)) throw new Error("Main contract address is invalid");
      await actions.nft_setMainContract?.(addr);
    });

  const applyNftVRFRouter = () =>
    run("nft_setVRF", async () => {
      const addr = nftVRFRouter.trim();
      if (!isAddress(addr)) throw new Error("VRF router address is invalid");
      await actions.nft_setVRFRouter?.(addr);
    });

  const createNftManualReward = () =>
    run("nft_manual", async () => {
      const winner = nftManualWinner.trim();
      const uri = nftManualUri.trim();
      if (!isAddress(winner)) throw new Error("Winner address is invalid");
      if (!uri) throw new Error("Token URI is required");
      const res = await actions.nft_createManualReward?.(winner, uri);
      if (res?.eventId != null) setNftLastEventId(String(res.eventId));
      if (res?.rewardId != null) setNftLastRewardId(String(res.rewardId));
    });

  const createNftMysteryEvent = () =>
    run("nft_mystery", async () => {
      const uris = splitListInput(nftMysteryUris);
      const eligible = parseAddressListInput(nftMysteryEligible);
      if (!uris.length) throw new Error("At least one token URI is required");
      if (!eligible.length)
        throw new Error("At least one eligible address is required");
      const res = await actions.nft_createMysteryEvent?.(uris, eligible);
      if (res?.eventId != null) setNftLastEventId(String(res.eventId));
    });

  const requestNftMysteryRandom = () =>
    run("nft_request", async () => {
      const eventId = nftMysteryEventId.trim();
      if (!eventId) throw new Error("Event ID is required");
      const res = await actions.nft_requestMysteryRandom?.(eventId);
      if (res?.requestId != null) setNftLastRequestId(String(res.requestId));
    });

  const loadChatAdmin = React.useCallback(async () => {
    setChatLoading(true);
    setChatError("");
    try {
      if (!supabaseReady || !supabase) {
        setChatError("Chat storage is not configured.");
        return;
      }
      const [rulesRes, msgsRes] = await Promise.all([
        supabase
          .from("rules")
          .select("text,updated_at")
          .eq("id", 1)
          .maybeSingle(),
        supabase
          .from("messages")
          .select(
            "id,author_address,author_name,content,created_at,edited_at,deleted",
          )
          .order("created_at", { ascending: false })
          .limit(60),
      ]);

      const rulesText = rulesRes?.data?.text ? String(rulesRes.data.text) : "";
      setChatRules((prevRules) => {
        setChatRulesDraft((prevDraft) => {
          if (!prevDraft || prevDraft === prevRules) return rulesText;
          return prevDraft;
        });
        return rulesText;
      });

      if (msgsRes?.error) throw msgsRes.error;
      const list = Array.isArray(msgsRes?.data) ? msgsRes.data : [];
      setChatMessages(list);
    } catch (err) {
      console.error("Admin chat load failed", err);
      setChatError("Failed to load chat data.");
    } finally {
      setChatLoading(false);
    }
  }, []);

  const applyChatModeration = () =>
    run("chat_moderate", async () => {
      const id = Number(chatMessageId);
      const action = chatAction === "edit" ? "edit" : "soft-delete";
      const nextContent = action === "edit" ? chatNewContent.trim() : "";
      if (!Number.isFinite(id) || id <= 0)
        throw new Error("Message ID is invalid");
      if (action === "edit" && !nextContent)
        throw new Error("New content is required");
      const { signer, signerAddress: address } =
        await getVerifiedAdminSigner(expectedOwner);
      const payload = `${action}|${id}|${nextContent || ""}`;
      const signature = await signer.signMessage(payload);

      const json = await fetchJsonWithTimeout(
        buildChatApiUrl("/admin/editMessage"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            signature,
            action,
            messageId: id,
            newContent: nextContent || undefined,
          }),
        },
      );
      if (!json?.ok) {
        throw new Error(json?.error || "Moderation failed");
      }
      await loadChatAdmin();
    });

  const updateChatRules = () =>
    run("chat_rules_update", async () => {
      const rulesText = chatRulesDraft.trim();
      if (!rulesText) throw new Error("Rules text is required");
      const { signer, signerAddress: address } =
        await getVerifiedAdminSigner(expectedOwner);
      const payload = `rules|${rulesText}`;
      const signature = await signer.signMessage(payload);

      const json = await fetchJsonWithTimeout(
        buildChatApiUrl("/admin/updateRules"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            signature,
            rulesText,
          }),
        },
      );
      if (!json?.ok) {
        throw new Error(json?.error || "Rules update failed");
      }
      setChatRules(rulesText);
      await loadChatAdmin();
    });
  // ---- Styles ----
  const backdrop = {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background:
      "radial-gradient(1000px 500px at 90% -10%, rgba(255,232,0,.10), transparent 60%)," +
      "radial-gradient(900px 480px at -10% 120%, rgba(155,123,255,.12), transparent 60%)," +
      "radial-gradient(800px 440px at 50% 120%, rgba(39,217,210,.10), transparent 60%)," +
      "linear-gradient(180deg, rgba(5,6,10,.94), rgba(5,6,9,.98))",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    padding: 18,
  };

  const topbar = {
    position: "sticky",
    top: 0,
    zIndex: 2,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    marginBottom: 10,
    borderRadius: 12,
    background:
      "linear-gradient(180deg, rgba(255,255,255,.04), rgba(0,0,0,.18))",
    border: `1px solid ${C.line}`,
    boxShadow: "0 12px 22px rgba(0,0,0,.35)",
    backdropFilter: "blur(2px)",
  };

  const scroller = {
    overflow: "auto",
    minHeight: 0,
  };

  const card = {
    background:
      "linear-gradient(145deg, rgba(20,20,24,.92), rgba(12,12,16,.92))",
    border: "1px solid rgba(255,232,0,.18)",
    borderRadius: 16,
    boxShadow:
      "0 18px 42px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.02)",
    overflow: "hidden",
  };

  const header = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 12px",
    borderRadius: 12,
  };

  const smallBtn = (active) => ({
    borderRadius: 10,
    background: active
      ? "linear-gradient(180deg, rgba(255,232,0,.9), rgba(255,232,0,.75))"
      : "linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.25))",
    border: `1px solid ${active ? "rgba(0,0,0,.25)" : C.line}`,
    color: active ? "#111" : C.text,
    fontWeight: 900,
    padding: "8px 12px",
    cursor: "pointer",
    opacity: 1,
  });

  const pill = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: 999,
    background:
      "linear-gradient(120deg, rgba(255,232,0,.16), rgba(255,232,0,.05))",
    border: "1px solid rgba(255,232,0,.28)",
    color: "#ffe800",
    fontWeight: 900,
  };

  const tabBtn = (active) => ({
    ...smallBtn(active),
    padding: "8px 14px",
    opacity: 1,
  });

  const sectionGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  };

  const Row = ({ k, children }) => (
    <div
      className="admin-panel__form-row"
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div style={{ color: C.dim, fontWeight: 800 }}>{k}</div>
      <div>{children}</div>
    </div>
  );

  // === KV TABLE (same look as VRF/Biggi tables) ===
  const KV = ({ items = [] }) => (
    <div
      className="admin-panel__table-scroll"
      style={{
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 14,
        overflowX: "auto",
        overflowY: "hidden",
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,.03), 0 10px 28px rgba(0,0,0,.45)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,.02), rgba(0,0,0,.2))",
      }}
    >
      <div
        style={{
          height: 2,
          background: "linear-gradient(90deg, #FF5DA2, #9B7BFF, #27D9D2)",
        }}
      />
      <table
        className="admin-kv-table"
        style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}
      >
        <thead>
          <tr>
            {["Key", "Value"].map((h, i, arr) => (
              <th
                key={h}
                style={{
                  padding: "12px 14px",
                  color: C.y,
                  textAlign: "left",
                  borderBottom: `1px solid ${C.line}`,
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background:
                    "linear-gradient(180deg, rgba(255,232,0,.18), rgba(255,232,0,.10))",
                  backdropFilter: "blur(4px)",
                  textShadow: "0 1px 0 rgba(0,0,0,.4)",
                  ...(i === 0 ? { borderTopLeftRadius: 12 } : {}),
                  ...(i === arr.length - 1 ? { borderTopRightRadius: 12 } : {}),
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody style={{ color: C.text }}>
          {items.map((r, i) => (
            <tr
              key={i}
              style={{
                borderBottom: `1px solid ${C.line}`,
                background:
                  i % 2 === 0
                    ? "linear-gradient(180deg, rgba(255,255,255,.02), rgba(0,0,0,.12))"
                    : "linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.16))",
              }}
            >
              <td
                style={{ padding: "10px 14px", color: C.dim, fontWeight: 800 }}
              >
                {r.k}
              </td>
              <td
                style={{
                  padding: "10px 14px",
                  fontFamily: r.mono ? "ui-monospace, Menlo" : "inherit",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
                title={String(r.v ?? "—")}
              >
                <span>{r.v ?? "—"}</span>
                {r.copy && (
                  <button
                    style={smallBtn(false)}
                    onClick={() => copyToClipboard(String(r.copy))}
                  >
                    Copy
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!items.length && (
            <tr>
              <td
                colSpan={2}
                style={{ padding: 14, textAlign: "center", color: C.dim }}
              >
                —
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div
        style={{
          height: 2,
          background: "linear-gradient(90deg, #27D9D2, #9B7BFF, #FF5DA2)",
        }}
      />
    </div>
  );

  const formatChatTime = (value) => {
    if (!value) return "--";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleString();
  };

  const pickChatMessage = (msg, mode = "soft-delete") => {
    if (!msg) return;
    setChatMessageId(String(msg.id ?? ""));
    setChatNewContent(String(msg.content || ""));
    setChatAction(mode === "edit" ? "edit" : "soft-delete");
  };

  const healthTargets = React.useMemo(() => {
    const items = [
      { key: "BIGGI TOKEN", label: "BIGGI TOKEN", address: ADDR.BIGGI },
      ...CORE_CHAPTERS.flatMap((chapter) => [
        {
          key: `CHAPTER_${chapter.chapterId}_VRF`,
          label: `${chapter.displayName} VRF`,
          address: chapter.main,
        },
        {
          key: `CHAPTER_${chapter.chapterId}_PUBLIC`,
          label: `${chapter.displayName} PUBLIC`,
          address: chapter.main2,
        },
      ]),
      {
        key: "COLLECTION_REWARDS",
        label: "COLLECTION_REWARDS",
        address: ADDR.COLLECTION_REWARDS,
      },
      {
        key: "COMMUNITY_CENTER",
        label: "COMMUNITY_CENTER",
        address: ADDR.COMMUNITY_CENTER,
      },
      { key: "DISTRIBUTOR", label: "DISTRIBUTOR", address: ADDR.DISTRIBUTOR },
      {
        key: "DRIP_DISTRIBUTOR",
        label: "DRIP_DISTRIBUTOR",
        address: ADDR.DRIP_DISTRIBUTOR,
      },
      {
        key: "DRIP_KEEPER_PROXY",
        label: "DRIP_KEEPER_PROXY",
        address: ADDR.DRIP_KEEPER_PROXY,
      },
      {
        key: "DRIP_LM",
        label: "DRIP_LM_V2",
        address: ADDR.DRIP_LM_V2 || ADDR.DRIP_LM,
      },
      { key: "FACTORY", label: "FACTORY", address: ADDR.FACTORY },
      { key: "KEEPER_ADDR", label: "KEEPER_ADDR", address: ADDR.KEEPER_ADDR },
      {
        key: "KEEPER_PROXY",
        label: "KEEPER_PROXY",
        address: ADDR.KEEPER_PROXY,
      },
      {
        key: "LIQUIDITY_AUTOMATION",
        label: "LIQUIDITY_AUTOMATION",
        address: ADDR.LIQUIDITY_AUTOMATION,
      },
      {
        key: "LIQUIDITY_MANAGER",
        label: "LIQUIDITY_MANAGER",
        address: ADDR.LM,
      },
      {
        key: "LIQUIDITY_SETUP",
        label: "LIQUIDITY_SETUP",
        address: ADDR.LIQUIDITY_SETUP,
      },
      {
        key: "LIQUIDITY_VAULT",
        label: "LIQUIDITY_VAULT",
        address: ADDR.LIQUIDITY_VAULT,
      },
      {
        key: "MASTER_CONFIG",
        label: "MASTER_CONFIG",
        address: ADDR.MASTER_CONFIG,
      },
      {
        key: "BUYBACK_AGENT",
        label: "BUYBACK_AGENT",
        address: ADDR.BUYBACK_AGENT,
      },
      { key: "NFT_REWARDS", label: "NFT_REWARDS", address: ADDR.NFT_REWARDS },
      { key: "PAIR", label: "PAIR", address: ADDR.PAIR },
      { key: "POLICY", label: "POLICY", address: ADDR.POLICY },
      { key: "RESERVE", label: "RESERVE", address: ADDR.RESERVE },
      { key: "ROUTER", label: "ROUTER", address: ADDR.ROUTER },
      {
        key: "TOKENOMIK_READER",
        label: "TOKENOMIK_READER",
        address: ADDR.BIGGI_TOKENOMICS_READER,
      },
      {
        key: "TOKEN_REWARDS",
        label: "TOKEN_REWARDS",
        address: ADDR.TOKEN_REWARDS,
      },
      { key: "TREASURY", label: "TREASURY", address: ADDR.TREASURY },
      {
        key: "UPKEEP_PROXY",
        label: "UPKEEP_PROXY",
        address: ADDR.UPKEEP_PROXY,
      },
      { key: "WETH", label: "WETH", address: ADDR.WETH },
      { key: "COMPUTE", label: "COMPUTE", address: ADDR.COMPUTE },
      {
        key: "BIGGIBUYBACKDRIPSETUP",
        label: "BIGGIBUYBACKDRIPSETUP",
        address: ADDR.BIGGIBUYBACKDRIPSETUP,
      },
      { key: "TICKET_HUB", label: "TICKET_HUB", address: ADDR.TICKET_HUB },
      { key: "VRF_ROUTER", label: "VRF_ROUTER", address: ADDR.VRF_ROUTER },
      {
        key: "SERIES_REGISTRY",
        label: "SERIES_REGISTRY",
        address: ADDR.SERIES_REGISTRY || ADDR.REGISTRY,
      },
      {
        key: "CHAPTER_CONTROLLER",
        label: "CHAPTER_CONTROLLER",
        address: ADDR.CHAPTER_CONTROLLER,
      },
      {
        key: "MODERATOR_CENTER_V2",
        label: "MODERATOR_CENTER_V2",
        address: ADDR.MODERATOR_CENTER_V2,
      },
      {
        key: "TOKEN_REWARDS_EMISSION_CONTROLLER",
        label: "TOKEN_REWARDS_EMISSION_CONTROLLER",
        address: ADDR.TOKEN_REWARDS_EMISSION_CONTROLLER,
      },
      {
        key: "LIQUIDITY_ORCHESTRATOR",
        label: "LIQUIDITY_ORCHESTRATOR",
        address: ADDR.LIQUIDITY_ORCHESTRATOR,
      },
      {
        key: "SUPPLY_CONTROLLER",
        label: "SUPPLY_CONTROLLER",
        address: ADDR.SUPPLY_CONTROLLER,
      },
      {
        key: "SUPPLY_GUARDIAN",
        label: "SUPPLY_GUARDIAN",
        address: ADDR.SUPPLY_GUARDIAN,
      },
      {
        key: "DEX_RESERVE_GUARD",
        label: "DEX_RESERVE_GUARD",
        address: ADDR.DEX_RESERVE_GUARD,
      },
    ];
    const omitted = new Set([
      "BIGGIBUYBACKDRIPSETUP",
      "DRIP_KEEPER_PROXY",
      "KEEPER_ADDR",
      "LIQUIDITY_AUTOMATION",
      "LIQUIDITY_SETUP",
    ]);
    const seen = new Set();
    return items.filter((item) => {
      if (omitted.has(item.key)) return false;
      if (!item.address || item.address === ZERO_ADDRESS) return false;
      const key = String(item.address).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const loadHealth = React.useCallback(async () => {
    setHealthLoading(true);
    setHealthError("");
    try {
      let provider = null;
      try {
        provider = getROProvider();
      } catch {}
      if (!provider && typeof window !== "undefined" && window.ethereum) {
        provider = new BrowserProvider(window.ethereum, "any");
      }
      if (!provider) throw new Error("Read provider unavailable");

      const startedAt = Date.now();
      const [network, blockNumber] = await Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber(),
      ]);
      if (Number(network?.chainId) !== expectedChainId) {
        throw new Error(
          `Health provider is on chain ${network?.chainId}; expected Polygon ${expectedChainId}`,
        );
      }
      const latencyMs = Date.now() - startedAt;
      const rpcUrl =
        provider?.connection?.url ||
        provider?.providers?.[0]?.provider?.connection?.url ||
        "";

      const checks = await Promise.all(
        healthTargets.map(async (target) => {
          const addr = target.address;
          if (!addr || !isAddress(addr)) {
            return { ...target, status: "invalid" };
          }
          try {
            const code = await provider.getCode(addr);
            const ok = code && code !== "0x";
            return {
              ...target,
              status: ok ? "ok" : "no-code",
              code: ok ? `${code.slice(0, 10)}…` : "0x",
            };
          } catch (err) {
            return { ...target, status: "error", error: shortErr(err) };
          }
        }),
      );

      let dex = null;
      if (ADDR.PAIR && isAddress(ADDR.PAIR)) {
        try {
          const pair = new Contract(ADDR.PAIR, V2_PAIR_ABI, provider);
          const [token0, token1, reserves] = await Promise.all([
            pair.token0(),
            pair.token1(),
            pair.getReserves(),
          ]);
          const reserve0 = BigInt(reserves?.reserve0 ?? reserves?.[0] ?? 0);
          const reserve1 = BigInt(reserves?.reserve1 ?? reserves?.[1] ?? 0);
          const biggiIsToken0 =
            String(token0).toLowerCase() === String(ADDR.BIGGI).toLowerCase();
          const biggiReserve = biggiIsToken0 ? reserve0 : reserve1;
          const quoteReserve = biggiIsToken0 ? reserve1 : reserve0;
          const seeded = biggiReserve > 0n && quoteReserve > 0n;
          dex = {
            status: seeded
              ? "seeded"
              : biggiReserve === 0n && quoteReserve === 0n
                ? "awaiting-liquidity"
                : "partial",
            pair: ADDR.PAIR,
            token0,
            token1,
            biggiReserve: formatEther(biggiReserve),
            quoteReserve: formatEther(quoteReserve),
          };
        } catch (error) {
          dex = { status: "error", pair: ADDR.PAIR, error: shortErr(error) };
        }
      }

      setHealthData({
        rpc: {
          chainId: network?.chainId,
          name: network?.name,
          blockNumber,
          latencyMs,
          rpcUrl,
          lastChecked: new Date().toLocaleString(),
        },
        contracts: checks,
        dex,
      });
    } catch (err) {
      setHealthError(shortErr(err));
    } finally {
      setHealthLoading(false);
    }
  }, [expectedChainId, healthTargets]);

  const healthTone = (status) => {
    switch (status) {
      case "ok":
        return {
          label: "OK",
          color: "#2dd4bf",
          border: "rgba(45,212,191,.5)",
          bg: "rgba(45,212,191,.12)",
        };
      case "no-code":
        return {
          label: "NO CODE",
          color: "#ffd166",
          border: "rgba(255,209,102,.5)",
          bg: "rgba(255,209,102,.12)",
        };
      case "invalid":
        return {
          label: "INVALID",
          color: "#ff9aa2",
          border: "rgba(255,154,162,.5)",
          bg: "rgba(255,154,162,.12)",
        };
      case "error":
        return {
          label: "ERROR",
          color: "#ff6b6b",
          border: "rgba(255,107,107,.5)",
          bg: "rgba(255,107,107,.12)",
        };
      default:
        return {
          label: "UNKNOWN",
          color: "#cbd5f5",
          border: "rgba(203,213,245,.5)",
          bg: "rgba(203,213,245,.12)",
        };
    }
  };

  const healthContracts = Array.isArray(healthData?.contracts)
    ? healthData.contracts
    : [];
  const rpcSnapshot = healthData?.rpc || null;
  const dexSnapshot = healthData?.dex || null;

  React.useEffect(() => {
    if (!open || activeTab !== "chat") return;
    loadChatAdmin();
  }, [open, activeTab, loadChatAdmin]);

  React.useEffect(() => {
    if (!open || activeTab !== "health") return;
    if (healthLoading) return;
    if (!healthData?.rpc) loadHealth();
  }, [open, activeTab, healthLoading, healthData, loadHealth]);

  // ESC to close, Ctrl+Enter to apply VRF
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (
        hasAction("setVRFParams") &&
        adminAccess.canWrite &&
        e.key === "Enter" &&
        (e.ctrlKey || e.metaKey)
      ) {
        run("setVRFParams", submitVRFParams);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adminAccess.canWrite, open, hasAction, onClose, run, submitVRFParams]);

  const tabs = React.useMemo(() => {
    const next = [{ id: "core", label: "Core" }];
    next.push({ id: "moderator", label: "Moderator Ops" });
    if (liquidityAvailable) next.push({ id: "liquidity", label: "Liquidity" });
    if (policyAvailable) next.push({ id: "POLICY", label: "POLICY" });
    next.push({ id: "community", label: "Community" });
    if (nftAvailable) next.push({ id: "nft", label: "NFT REWARDS" });
    next.push({ id: "chat", label: "Live Chat" });
    next.push({ id: "health", label: "Health" });
    if (frontendAvailable) next.push({ id: "frontend", label: "Frontend" });
    return next;
  }, [frontendAvailable, liquidityAvailable, nftAvailable, policyAvailable]);

  React.useEffect(() => {
    if (tabs.some((tab) => tab.id === activeTab)) return;
    setActiveTab(tabs[0]?.id || "core");
  }, [activeTab, tabs]);

  // ---- UI ----
  if (!open) return null;

  return (
    <div
      className="admin-panel__backdrop"
      style={backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Admin panel"
    >
      {/* Sticky topbar */}
      <div
        className="admin-panel__topbar"
        style={topbar}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "grid", gap: 2 }}>
          <h2
            style={{
              margin: 0,
              color: C.y,
              textTransform: "uppercase",
              letterSpacing: ".04em",
              textShadow: "0 0 12px rgba(255,232,0,.35)",
              fontWeight: 900,
            }}
          >
            Admin Panel
          </h2>
          <p
            style={{
              margin: 0,
              color: "#c8cae3",
              fontSize: 12,
              lineHeight: 1.35,
            }}
          >
            Configure mainnet tokenomics, monitor live contract state, and run
            guarded admin actions from one control surface.
          </p>
        </div>
        <div
          className="admin-panel__topbar-actions"
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <span style={pill}>Owner: {short(data?.owner)}</span>
          <span style={pill}>
            {adminAccess.chainMatches
              ? "Polygon 137"
              : adminAccess.chainId
                ? `Wrong chain: ${adminAccess.chainId}`
                : "Checking network"}
          </span>
          <span style={pill}>
            {adminAccess.ownerMatches ? "Owner wallet" : "Read only"}
          </span>
          {hasAction("refresh") && (
            <button
              style={smallBtn(true)}
              disabled={!!pending.refresh}
              onClick={() => run("refresh", actions.refresh)}
              title="Reload on-chain snapshot"
            >
              {pending.refresh ? "Refreshing…" : "Refresh"}
            </button>
          )}
          <button style={smallBtn(false)} onClick={onClose} title="Esc">
            Close
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div
        className="admin-panel__scroller"
        style={scroller}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status line */}
        {statusMsg && (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${C.line}`,
              color: C.text,
              background:
                "linear-gradient(180deg, rgba(255,255,255,.04), rgba(0,0,0,.18))",
              boxShadow: "inset 0 0 10px rgba(255,255,255,.04)",
            }}
          >
            {statusMsg}
          </div>
        )}

        {!adminAccess.canWrite && (
          <div className="admin-panel__access-warning" role="status">
            {adminAccess.chainId == null
              ? "Checking the connected wallet network before enabling writes."
              : !adminAccess.chainMatches
                ? `Admin writes are locked. Switch the wallet to Polygon mainnet (${expectedChainId}).`
                : "Admin writes are locked because the connected wallet is not the configured owner."}
          </div>
        )}

        <div
          className="admin-panel__tabs"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              style={tabBtn(activeTab === tab.id)}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "core" && (
          <div
            className="admin-panel__core-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 1fr",
              gap: 18,
            }}
          >
            {/* LEFT: SNAPSHOT */}
            <section style={card}>
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  On-Chain Snapshot
                </h3>
              </div>
              <div style={{ padding: 12 }}>
                <KV
                  items={[
                    { k: "Network", v: data?.networkLabel || "EVM" },
                    {
                      k: "Active VRF collection",
                      v: short(data?.contractAddress),
                      mono: true,
                      copy: data?.contractAddress,
                    },
                    {
                      k: "Paired public collection",
                      v: short(data?.publicContractAddress),
                      mono: true,
                      copy: data?.publicContractAddress,
                    },
                    {
                      k: "TicketHub",
                      v: short(data?.ticketHub?.address),
                      mono: true,
                      copy: data?.ticketHub?.address,
                    },
                    {
                      k: "TicketHub paused",
                      v:
                        data?.ticketHub?.paused == null
                          ? "--"
                          : data.ticketHub.paused
                            ? "TRUE"
                            : "FALSE",
                    },
                    {
                      k: "Active chapter",
                      v: data?.ticketHub?.activeChapterId ?? "None",
                    },
                    {
                      k: "Active chapter count",
                      v: data?.ticketHub?.activeChapterCount ?? "--",
                    },
                    { k: "Chapter NFT supply", v: data?.totalSupply ?? "--" },
                    { k: "Chapter max supply", v: data?.maxSupply ?? "--" },
                    {
                      k: "Ticket Price",
                      v:
                        data?.ticketPrice == null || data.ticketPrice === ""
                          ? "--"
                          : `${data.ticketPrice} POL`,
                    },
                    {
                      k: "Public ticket sales",
                      v: `${data?.ticketHub?.saleMinted ?? "--"} / ${
                        data?.ticketHub?.saleCap ?? "--"
                      }`,
                    },
                    {
                      k: "Marketing tickets",
                      v: `${data?.ticketHub?.marketingMinted ?? "--"} / ${
                        data?.ticketHub?.marketingCap ?? "--"
                      }`,
                    },
                    {
                      k: "Collection Rewards pool",
                      v:
                        data?.REWARDSPool == null || data.REWARDSPool === ""
                          ? "--"
                          : `${data.REWARDSPool} POL`,
                    },
                    {
                      k: "Treasury",
                      v: short(data?.treasury),
                      mono: true,
                      copy: data?.treasury,
                    },
                    {
                      k: "Liquidity Sink",
                      v: short(data?.liquiditySink),
                      mono: true,
                      copy: data?.liquiditySink,
                    },
                    {
                      k: "Token (BIGGI)",
                      v: short(data?.token?.address),
                      mono: true,
                      copy: data?.token?.address,
                    },
                    {
                      k: "DEX Router",
                      v: short(data?.dex?.router),
                      mono: true,
                      copy: data?.dex?.router,
                    },
                    {
                      k: "DEX Pair",
                      v: short(data?.dex?.pair),
                      mono: true,
                      copy: data?.dex?.pair,
                    },
                    {
                      k: "Shared VRF Router",
                      v: short(data?.VRF?.router),
                      mono: true,
                      copy: data?.VRF?.router,
                    },
                    {
                      k: "VRF KeyHash",
                      v: data?.VRF?.keyHash,
                      mono: true,
                      copy: data?.VRF?.keyHash,
                    },
                    { k: "VRF Conf.", v: data?.VRF?.confirmations },
                    { k: "VRF NumWords", v: data?.VRF?.numWords },
                    { k: "VRF GasLimit", v: data?.VRF?.callbackGasLimit },
                    {
                      k: "VRF Coordinator",
                      v: short(data?.VRF?.coordinator),
                      mono: true,
                      copy: data?.VRF?.coordinator,
                    },
                    {
                      k: "VRF SubID",
                      v: data?.VRF?.subscriptionId,
                      mono: true,
                      copy: data?.VRF?.subscriptionId,
                    },
                  ]}
                />

                {Array.isArray(data?.chapters) && data.chapters.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        color: C.y,
                        fontWeight: 900,
                        marginBottom: 8,
                      }}
                    >
                      Chapter registry
                    </div>
                    <div className="admin-panel__table-scroll">
                      <table className="admin-panel__data-table">
                        <thead>
                          <tr>
                            <th>Chapter</th>
                            <th>Status</th>
                            <th>VRF collection</th>
                            <th>Public collection</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.chapters.map((chapter) => (
                            <tr key={chapter.chapterId}>
                              <td>
                                {chapter.chapterId}. {chapter.displayName}
                              </td>
                              <td>{chapter.active ? "ACTIVE" : "INACTIVE"}</td>
                              <td title={chapter.main}>
                                {short(chapter.main)}
                              </td>
                              <td title={chapter.main2}>
                                {short(chapter.main2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Blocks table – styled like VRF/Biggi tables */}
                {Array.isArray(data?.blocks) && data.blocks.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        color: C.y,
                        fontWeight: 900,
                        marginBottom: 8,
                      }}
                    >
                      Chapter {data?.displayedChapterId || 1} block state
                    </div>

                    <div
                      style={{
                        padding: 0,
                        overflowX: "auto",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,.08)",
                        boxShadow:
                          "inset 0 0 0 1px rgba(255,255,255,.03), 0 10px 28px rgba(0,0,0,.45)",
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,.02), rgba(0,0,0,.2))",
                      }}
                    >
                      <div
                        style={{
                          height: 2,
                          background:
                            "linear-gradient(90deg, #FF5DA2, #9B7BFF, #27D9D2)",
                        }}
                      />
                      <table
                        className="admin-blocks-table"
                        style={{
                          width: "100%",
                          borderCollapse: "separate",
                          borderSpacing: 0,
                          minWidth: 560,
                          fontSize: 14,
                        }}
                      >
                        <thead>
                          <tr style={{ color: C.text, textAlign: "left" }}>
                            {["Idx", "Name", "Base", "Current", "Minted"].map(
                              (h, i, arr) => (
                                <th
                                  key={h}
                                  style={{
                                    padding: "12px 14px",
                                    borderBottom: `1px solid ${C.line}`,
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 1,
                                    background:
                                      "linear-gradient(180deg, rgba(255,232,0,.18), rgba(255,232,0,.10))",
                                    backdropFilter: "blur(4px)",
                                    color: C.y,
                                    textShadow: "0 1px 0 rgba(0,0,0,.4)",
                                    ...(i === 0
                                      ? { borderTopLeftRadius: 14 }
                                      : {}),
                                    ...(i === arr.length - 1
                                      ? { borderTopRightRadius: 14 }
                                      : {}),
                                  }}
                                >
                                  {h}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody style={{ color: C.text }}>
                          {data.blocks.map((b, i) => (
                            <tr
                              key={i}
                              style={{
                                borderBottom: `1px solid ${C.line}`,
                                background:
                                  i % 2 === 0
                                    ? "linear-gradient(180deg, rgba(255,255,255,.02), rgba(0,0,0,.12))"
                                    : "linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.16))",
                              }}
                            >
                              <td style={{ padding: "10px 14px" }}>{i}</td>
                              <td style={{ padding: "10px 14px" }}>{b.name}</td>
                              <td style={{ padding: "10px 14px" }}>
                                {num(b.basePrice ?? b.price)} POL
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                {num(b.currentPrice ?? b.price)} POL
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                {num(b.minted)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div
                        style={{
                          height: 2,
                          background:
                            "linear-gradient(90deg, #27D9D2, #9B7BFF, #FF5DA2)",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* RIGHT: SETTERS */}
            <section style={card}>
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  Owner Controls
                </h3>
              </div>

              <div style={{ padding: 12, display: "grid", gap: 16 }}>
                {!hasCoreSetters && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${C.line}`,
                      background: "rgba(255, 209, 102, 0.14)",
                      color: "#ffe29a",
                    }}
                  >
                    No owner actions are available for the active Core
                    deployment.
                  </div>
                )}

                {/* Pause/Unpause + BaseURI */}
                {(coreAvailability.pause || coreAvailability.baseURI) && (
                  <div style={sectionGrid}>
                    <div>
                      <div
                        style={{
                          color: C.dim,
                          fontWeight: 900,
                          marginBottom: 6,
                        }}
                      >
                        Pause
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <label
                          style={{
                            display: "inline-flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={pauseFlag}
                            onChange={(e) => setPauseFlag(e.target.checked)}
                          />
                          <span>Paused</span>
                        </label>
                        <button
                          style={smallBtn(true)}
                          disabled={
                            !coreAvailability.pause || !!pending.setPaused
                          }
                          onClick={() =>
                            run(
                              "setPaused",
                              () =>
                                actions.setPaused &&
                                actions.setPaused(pauseFlag),
                            )
                          }
                        >
                          {pending.setPaused ? "Setting…" : "Set"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          color: C.dim,
                          fontWeight: 900,
                          marginBottom: 6,
                        }}
                      >
                        BaseURI
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={baseURI}
                          onChange={(e) => setBaseURI(e.target.value)}
                          placeholder="ipfs://CID/"
                          style={inputStyle()}
                        />
                        <button
                          style={smallBtn(true)}
                          disabled={
                            !coreAvailability.baseURI || !!pending.setBaseURI
                          }
                          onClick={() =>
                            run(
                              "setBaseURI",
                              () =>
                                actions.setBaseURI &&
                                actions.setBaseURI(baseURI),
                            )
                          }
                        >
                          {pending.setBaseURI ? "Setting…" : "Set"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ticket price + Block base price */}
                {(coreAvailability.ticketPrice ||
                  coreAvailability.blockBasePrice) && (
                  <div style={sectionGrid}>
                    <div>
                      <div
                        style={{
                          color: C.dim,
                          fontWeight: 900,
                          marginBottom: 6,
                        }}
                      >
                        Ticket Price (POL)
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={ticketPrice}
                          onChange={(e) => setTicketPrice(e.target.value)}
                          placeholder="e.g. 500"
                          style={inputStyle()}
                        />
                        <button
                          style={smallBtn(true)}
                          disabled={
                            !coreAvailability.ticketPrice ||
                            !!pending.setTicketPrice
                          }
                          onClick={() =>
                            run(
                              "setTicketPrice",
                              () =>
                                actions.setTicketPrice &&
                                actions.setTicketPrice(Number(ticketPrice)),
                            )
                          }
                        >
                          {pending.setTicketPrice ? "Setting…" : "Set"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          color: C.dim,
                          fontWeight: 900,
                          marginBottom: 6,
                        }}
                      >
                        Block Base Price
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "80px 1fr auto",
                          gap: 8,
                        }}
                      >
                        <input
                          value={blockIdx}
                          onChange={(e) => setBlockIdx(e.target.value)}
                          placeholder="idx"
                          style={inputStyle()}
                        />
                        <input
                          value={blockBasePrice}
                          onChange={(e) => setBlockBasePrice(e.target.value)}
                          placeholder="price"
                          style={inputStyle()}
                        />
                        <button
                          style={smallBtn(true)}
                          disabled={
                            !coreAvailability.blockBasePrice ||
                            !!pending.setBlockBasePrice
                          }
                          onClick={() =>
                            run(
                              "setBlockBasePrice",
                              () =>
                                actions.setBlockBasePrice &&
                                actions.setBlockBasePrice(
                                  Number(blockIdx),
                                  Number(blockBasePrice),
                                ),
                            )
                          }
                        >
                          {pending.setBlockBasePrice ? "Setting…" : "Set"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* VRF setup */}
                {coreAvailability.vrf && (
                  <div
                    style={{
                      borderTop: `1px dashed ${C.line}`,
                      paddingTop: 12,
                    }}
                  >
                    <div
                      style={{
                        color: C.dim,
                        fontWeight: 900,
                        marginBottom: 10,
                      }}
                    >
                      Shared VRF Router (Ctrl+Enter = Apply)
                    </div>
                    <div
                      style={{
                        color: C.dim,
                        fontSize: 13,
                        lineHeight: 1.45,
                        marginBottom: 10,
                      }}
                    >
                      These parameters are shared by every approved VRF chapter.
                      The deployed coordinator address is immutable.
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <Row k="KeyHash">
                        <input
                          value={VRF.keyHash}
                          onChange={(e) =>
                            setVRF({ ...VRF, keyHash: e.target.value })
                          }
                          style={inputStyle(true)}
                        />
                      </Row>
                      <Row k="Confirmations">
                        <input
                          type="number"
                          value={VRF.confirmations}
                          onChange={(e) =>
                            setVRF({
                              ...VRF,
                              confirmations: Number(e.target.value),
                            })
                          }
                          style={inputStyle()}
                        />
                      </Row>
                      <Row k="NumWords">
                        <input
                          type="number"
                          value={VRF.numWords}
                          onChange={(e) =>
                            setVRF({ ...VRF, numWords: Number(e.target.value) })
                          }
                          style={inputStyle()}
                        />
                      </Row>
                      <Row k="Callback Gas">
                        <input
                          type="number"
                          value={VRF.callbackGasLimit}
                          onChange={(e) =>
                            setVRF({
                              ...VRF,
                              callbackGasLimit: Number(e.target.value),
                            })
                          }
                          style={inputStyle()}
                        />
                      </Row>
                      <Row k="Coordinator">
                        <input
                          value={VRF.coordinator}
                          style={inputStyle(true)}
                          readOnly
                          aria-readonly="true"
                          title="Coordinator is fixed in the deployed VRF Router"
                        />
                      </Row>
                      <Row k="Subscription Id">
                        <input
                          value={VRF.subscriptionId}
                          onChange={(e) =>
                            setVRF({
                              ...VRF,
                              subscriptionId: e.target.value,
                            })
                          }
                          style={inputStyle()}
                        />
                      </Row>
                      <div
                        style={{ display: "flex", justifyContent: "flex-end" }}
                      >
                        <button
                          style={smallBtn(true)}
                          disabled={
                            !coreAvailability.vrf ||
                            !adminAccess.canWrite ||
                            !!pending.setVRFParams
                          }
                          onClick={() => run("setVRFParams", submitVRFParams)}
                          title="Apply VRF params"
                        >
                          {pending.setVRFParams ? "Applying…" : "Apply VRF"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Addresses */}
                {(coreAvailability.treasury ||
                  coreAvailability.liquiditySink ||
                  coreAvailability.tokenAddress ||
                  coreAvailability.router) && (
                  <div
                    style={{
                      borderTop: `1px dashed ${C.line}`,
                      paddingTop: 12,
                    }}
                  >
                    <div
                      style={{
                        color: C.dim,
                        fontWeight: 900,
                        marginBottom: 10,
                      }}
                    >
                      Addresses
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <Row k="Treasury">
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            value={treasury}
                            onChange={(e) => setTreasury(e.target.value)}
                            style={inputStyle(true)}
                          />
                          <button
                            style={smallBtn(true)}
                            disabled={
                              !coreAvailability.treasury ||
                              !!pending.setTreasury
                            }
                            onClick={() =>
                              run(
                                "setTreasury",
                                () =>
                                  actions.setTreasury &&
                                  actions.setTreasury(treasury),
                              )
                            }
                          >
                            {pending.setTreasury ? "Saving…" : "Set"}
                          </button>
                        </div>
                      </Row>
                      <Row k="Liquidity Sink">
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            value={liquiditySink}
                            onChange={(e) => setLiquiditySink(e.target.value)}
                            style={inputStyle(true)}
                          />
                          <button
                            style={smallBtn(true)}
                            disabled={
                              !coreAvailability.liquiditySink ||
                              !!pending.setLiquiditySink
                            }
                            onClick={() =>
                              run(
                                "setLiquiditySink",
                                () =>
                                  actions.setLiquiditySink &&
                                  actions.setLiquiditySink(liquiditySink),
                              )
                            }
                          >
                            {pending.setLiquiditySink ? "Saving…" : "Set"}
                          </button>
                        </div>
                      </Row>
                      <Row k="BIGGI ECOSYSTEM">
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            value={tokenAddress}
                            onChange={(e) => setTokenAddress(e.target.value)}
                            style={inputStyle(true)}
                          />
                          <button
                            style={smallBtn(true)}
                            disabled={
                              !coreAvailability.tokenAddress ||
                              !!pending.setTokenAddress
                            }
                            onClick={() =>
                              run(
                                "setTokenAddress",
                                () =>
                                  actions.setTokenAddress &&
                                  actions.setTokenAddress(tokenAddress),
                              )
                            }
                          >
                            {pending.setTokenAddress ? "Saving…" : "Set"}
                          </button>
                        </div>
                      </Row>
                      <Row k="DEX Router">
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            value={routerAddress}
                            onChange={(e) => setRouterAddress(e.target.value)}
                            style={inputStyle(true)}
                          />
                          <button
                            style={smallBtn(true)}
                            disabled={
                              !coreAvailability.router || !!pending.setRouter
                            }
                            onClick={() =>
                              run(
                                "setRouter",
                                () =>
                                  actions.setRouter &&
                                  actions.setRouter(routerAddress),
                              )
                            }
                          >
                            {pending.setRouter ? "Saving…" : "Set"}
                          </button>
                        </div>
                      </Row>
                    </div>
                  </div>
                )}

                {/* Finance ops */}
                {(coreAvailability.withdrawNative ||
                  coreAvailability.withdrawToken ||
                  coreAvailability.sweepDust) && (
                  <div
                    style={{
                      borderTop: `1px dashed ${C.line}`,
                      paddingTop: 12,
                    }}
                  >
                    <div
                      style={{
                        color: C.dim,
                        fontWeight: 900,
                        marginBottom: 10,
                      }}
                    >
                      Finance
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        style={smallBtn(true)}
                        disabled={
                          !coreAvailability.withdrawNative ||
                          !!pending.withdrawNative
                        }
                        onClick={() =>
                          run(
                            "withdrawNative",
                            () =>
                              actions.withdrawNative &&
                              actions.withdrawNative(),
                          )
                        }
                      >
                        {pending.withdrawNative
                          ? "Withdrawing…"
                          : "Withdraw Native"}
                      </button>
                      <button
                        style={smallBtn(true)}
                        disabled={
                          !coreAvailability.withdrawToken ||
                          !!pending.withdrawToken
                        }
                        onClick={() =>
                          run(
                            "withdrawToken",
                            () =>
                              actions.withdrawToken && actions.withdrawToken(),
                          )
                        }
                      >
                        {pending.withdrawToken
                          ? "Withdrawing…"
                          : "Withdraw BIGGI"}
                      </button>
                      <button
                        style={smallBtn(true)}
                        disabled={
                          !coreAvailability.sweepDust || !!pending.sweepDust
                        }
                        onClick={() =>
                          run(
                            "sweepDust",
                            () => actions.sweepDust && actions.sweepDust(),
                          )
                        }
                      >
                        {pending.sweepDust ? "Sweeping…" : "Sweep Dust"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "moderator" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
            <section style={card}>
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  Moderator Center Owner Ops
                </h3>
              </div>
              <div style={{ padding: 12, display: "grid", gap: 12 }}>
                <p style={{ margin: 0, color: C.dim, lineHeight: 1.6 }}>
                  On-chain ModeratorCenter V2 status, emergency pause, weekly
                  settlement, slot weights, and payout liabilities.
                </p>
                <AdminDashboard
                  walletAddress={ownerWallet}
                  canWrite={adminAccess.canWrite}
                  onTx={(payload) => {
                    const message = String(payload?.message || "").trim();
                    const txHash = String(payload?.txHash || "").trim();
                    const suffix = txHash ? ` (${short(txHash)})` : "";
                    setStatusMsg(
                      message ? `${message}${suffix}` : "Tx submitted",
                    );
                  }}
                />
              </div>
            </section>
          </div>
        )}

        {(activeTab === "liquidity" || activeTab === "community") && (
          <div
            className="admin-panel__section-block"
            style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}
          >
            <section
              style={{
                ...card,
                display: activeTab === "liquidity" ? undefined : "none",
              }}
            >
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  Liquidity Controls
                </h3>
              </div>
              <div style={{ padding: 12, display: "grid", gap: 16 }}>
                <div
                  style={{ color: C.dim, fontWeight: 900, marginBottom: 10 }}
                >
                  Liquidity Settings
                </div>
                <div style={sectionGrid}>
                  <div>
                    <div
                      style={{
                        color: C.dim,
                        fontWeight: 900,
                        marginBottom: 6,
                      }}
                    >
                      Liquidity Recipient
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={liqRecipient}
                        onChange={(e) => setLiqRecipient(e.target.value)}
                        style={inputStyle(true)}
                        placeholder="0x..."
                      />
                      <button
                        style={smallBtn(true)}
                        disabled={!!pending.liq_setRecipient}
                        onClick={() =>
                          run(
                            "liq_setRecipient",
                            () =>
                              actions.liq_setLiquidityRecipient &&
                              actions.liq_setLiquidityRecipient(liqRecipient),
                          )
                        }
                      >
                        {pending.liq_setRecipient ? "Saving..." : "Set"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        color: C.dim,
                        fontWeight: 900,
                        marginBottom: 6,
                      }}
                    >
                      LP Use Balance (bps)
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={lpUseBps}
                        onChange={(e) => setLpUseBps(e.target.value)}
                        style={inputStyle()}
                        placeholder="e.g. 5000 = 50%"
                      />
                      <button
                        style={smallBtn(true)}
                        disabled={!!pending.liq_setLpUseBps}
                        onClick={() =>
                          run(
                            "liq_setLpUseBps",
                            () =>
                              actions.liq_setLpUseBalanceBps &&
                              actions.liq_setLpUseBalanceBps(Number(lpUseBps)),
                          )
                        }
                      >
                        {pending.liq_setLpUseBps ? "Saving..." : "Set"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        color: C.dim,
                        fontWeight: 900,
                        marginBottom: 6,
                      }}
                    >
                      Swap Slippage (bps)
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={swapSlip}
                        onChange={(e) => setSwapSlip(e.target.value)}
                        style={inputStyle()}
                        placeholder="e.g. 200 = 2%"
                      />
                      <button
                        style={smallBtn(true)}
                        disabled={!!pending.liq_setSwapSlip}
                        onClick={() =>
                          run(
                            "liq_setSwapSlip",
                            () =>
                              actions.liq_setSwapSlippageBps &&
                              actions.liq_setSwapSlippageBps(Number(swapSlip)),
                          )
                        }
                      >
                        {pending.liq_setSwapSlip ? "Saving..." : "Set"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        color: C.dim,
                        fontWeight: 900,
                        marginBottom: 6,
                      }}
                    >
                      LP Add Slippage (bps)
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={lpSlip}
                        onChange={(e) => setLpSlip(e.target.value)}
                        style={inputStyle()}
                        placeholder="e.g. 200 = 2%"
                      />
                      <button
                        style={smallBtn(true)}
                        disabled={!!pending.liq_setLpSlip}
                        onClick={() =>
                          run(
                            "liq_setLpSlip",
                            () =>
                              actions.liq_setLpAddSlippageBps &&
                              actions.liq_setLpAddSlippageBps(Number(lpSlip)),
                          )
                        }
                      >
                        {pending.liq_setLpSlip ? "Saving..." : "Set"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        color: C.dim,
                        fontWeight: 900,
                        marginBottom: 6,
                      }}
                    >
                      Tx Deadline (sec)
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={txDeadline}
                        onChange={(e) => setTxDeadline(e.target.value)}
                        style={inputStyle()}
                        placeholder="e.g. 600"
                      />
                      <button
                        style={smallBtn(true)}
                        disabled={!!pending.liq_setDeadline}
                        onClick={() =>
                          run(
                            "liq_setDeadline",
                            () =>
                              actions.liq_setTxDeadline &&
                              actions.liq_setTxDeadline(Number(txDeadline)),
                          )
                        }
                      >
                        {pending.liq_setDeadline ? "Saving..." : "Set"}
                      </button>
                    </div>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <div
                      style={{
                        color: C.dim,
                        fontWeight: 900,
                        marginBottom: 6,
                      }}
                    >
                      Swap Path (comma separated)
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        value={swapPath}
                        onChange={(e) => setSwapPath(e.target.value)}
                        style={inputStyle(true)}
                        placeholder="WNATIVE,0x...,0xBIGGI"
                      />
                      <button
                        style={smallBtn(true)}
                        disabled={!!pending.liq_setSwapPath}
                        onClick={() =>
                          run("liq_setSwapPath", () => {
                            const arr = swapPath
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean);
                            return (
                              actions.liq_setSwapPath &&
                              actions.liq_setSwapPath(arr)
                            );
                          })
                        }
                      >
                        {pending.liq_setSwapPath ? "Saving..." : "Set Path"}
                      </button>
                      <button
                        style={smallBtn(false)}
                        disabled={!!pending.liq_clearSwapPath}
                        onClick={() =>
                          run(
                            "liq_clearSwapPath",
                            () =>
                              actions.liq_clearSwapPath &&
                              actions.liq_clearSwapPath(),
                          )
                        }
                      >
                        {pending.liq_clearSwapPath
                          ? "Clearing..."
                          : "Clear Path"}
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    color: C.dim,
                    fontWeight: 900,
                    margin: "14px 0 6px",
                  }}
                >
                  Liquidity Actions
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        marginBottom: 6,
                        color: C.dim,
                        fontWeight: 800,
                      }}
                    >
                      BUYBACK to Treasury
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr auto",
                        gap: 8,
                      }}
                    >
                      <input
                        value={nativeAmt}
                        onChange={(e) => setNativeAmt(e.target.value)}
                        style={inputStyle()}
                        placeholder="Native (e.g. 10)"
                      />
                      <input
                        value={minOut}
                        onChange={(e) => setMinOut(e.target.value)}
                        style={inputStyle()}
                        placeholder="minOut BIGGI (opt.)"
                      />
                      <button
                        style={smallBtn(true)}
                        disabled={!!pending.liq_BUYBACK}
                        onClick={() =>
                          run(
                            "liq_BUYBACK",
                            () =>
                              actions.liq_BUYBACKToTreasury &&
                              actions.liq_BUYBACKToTreasury(nativeAmt, minOut),
                          )
                        }
                      >
                        {pending.liq_BUYBACK ? "Buying..." : "BUYBACK"}
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button
                        style={smallBtn(true)}
                        disabled={!!pending.liq_BUYBACKAll}
                        onClick={() =>
                          run(
                            "liq_BUYBACKAll",
                            () =>
                              actions.liq_BUYBACKAllToTreasury &&
                              actions.liq_BUYBACKAllToTreasury(minOut),
                          )
                        }
                      >
                        {pending.liq_BUYBACKAll ? "Buying..." : "BUYBACK ALL"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        marginBottom: 6,
                        color: C.dim,
                        fontWeight: 800,
                      }}
                    >
                      Add Liquidity (from balances)
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr auto",
                        gap: 8,
                      }}
                    >
                      <input
                        value={biggiAmt}
                        onChange={(e) => setBiggiAmt(e.target.value)}
                        style={inputStyle()}
                        placeholder="BIGGI amount"
                      />
                      <input
                        value={nativeAmt}
                        onChange={(e) => setNativeAmt(e.target.value)}
                        style={inputStyle()}
                        placeholder="Native (msg.value)"
                      />
                      <button
                        style={smallBtn(true)}
                        disabled={!!pending.liq_addLp}
                        onClick={() =>
                          run(
                            "liq_addLp",
                            () =>
                              actions.liq_addLiquidityFromBalances &&
                              actions.liq_addLiquidityFromBalances(
                                biggiAmt,
                                nativeAmt,
                              ),
                          )
                        }
                      >
                        {pending.liq_addLp ? "Adding..." : "Add LP"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        marginBottom: 6,
                        color: C.dim,
                        fontWeight: 800,
                      }}
                    >
                      Bootstrap Liquidity
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr auto",
                        gap: 8,
                      }}
                    >
                      <input
                        value={bootToken}
                        onChange={(e) => setBootToken(e.target.value)}
                        style={inputStyle()}
                        placeholder="Token amount"
                      />
                      <input
                        value={bootEth}
                        onChange={(e) => setBootEth(e.target.value)}
                        style={inputStyle()}
                        placeholder="Native amount"
                      />
                      <button
                        style={smallBtn(true)}
                        disabled={!!pending.liq_bootstrap}
                        onClick={() =>
                          run(
                            "liq_bootstrap",
                            () =>
                              actions.liq_bootstrapLiquidity &&
                              actions.liq_bootstrapLiquidity(
                                bootToken,
                                bootEth,
                              ),
                          )
                        }
                      >
                        {pending.liq_bootstrap
                          ? "Bootstrapping..."
                          : "Bootstrap"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        marginBottom: 6,
                        color: C.dim,
                        fontWeight: 800,
                      }}
                    >
                      Route BIGGI to Treasury
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 8,
                      }}
                    >
                      <input
                        value={routeBiggiAmt}
                        onChange={(e) => setRouteBiggiAmt(e.target.value)}
                        style={inputStyle()}
                        placeholder="BIGGI amount"
                      />
                      <button
                        style={smallBtn(true)}
                        disabled={!!pending.liq_route}
                        onClick={() =>
                          run(
                            "liq_route",
                            () =>
                              actions.liq_routeBiggiToTreasury &&
                              actions.liq_routeBiggiToTreasury(routeBiggiAmt),
                          )
                        }
                      >
                        {pending.liq_route ? "Routing..." : "Route"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              style={{
                ...card,
                display: activeTab === "community" ? undefined : "none",
              }}
            >
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  Community Center Owner Ops
                </h3>
                <button
                  style={smallBtn(false)}
                  disabled={!communityAvailable || !!pending.community_overview}
                  onClick={() => communityAvailable && loadCommunityOverview()}
                >
                  {pending.community_overview
                    ? "Refreshing..."
                    : "Refresh overview"}
                </button>
              </div>
              <div style={{ padding: 12, display: "grid", gap: 16 }}>
                <p style={{ margin: 0, color: C.dim }}>
                  Owner-only contract operations for the Community Center. This
                  is where distributor, pool, pause, rescue, and emergency flows
                  now live.
                </p>

                {!communityAccess.canWrite && communityAvailable && (
                  <div className="admin-panel__access-warning" role="status">
                    Community writes remain disabled until the connected wallet
                    is the Community Center owner on Polygon mainnet.
                  </div>
                )}

                {!communityAvailable && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${C.line}`,
                      background: "rgba(255, 88, 88, 0.14)",
                      color: "#ffb3b3",
                    }}
                  >
                    Community Center is missing from the active deployment
                    configuration. Owner operations are disabled.
                  </div>
                )}

                <KV
                  items={[
                    {
                      k: "Contract",
                      v: short(communityAddress),
                      mono: true,
                      copy: communityAddress,
                    },
                    {
                      k: "Owner",
                      v: short(communityOwner),
                      mono: true,
                      copy: communityOwner,
                    },
                    {
                      k: "Distributor",
                      v: short(communityDistributor),
                      mono: true,
                      copy: communityDistributor,
                    },
                    { k: "Pool balance", v: communityPoolBalance || "--" },
                    { k: "Total locked", v: communityTotalLocked || "--" },
                    {
                      k: "Contract balance",
                      v: communityContractBalance || "--",
                    },
                    { k: "Next event ID", v: communityNextEventId || "--" },
                    {
                      k: "Paused",
                      v: communityPaused ? "TRUE" : "FALSE",
                    },
                    {
                      k: "Write access",
                      v: communityAccess.canWrite ? "ENABLED" : "READ ONLY",
                    },
                  ]}
                />

                <div
                  style={{
                    display: "grid",
                    gap: 16,
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  }}
                >
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ color: C.dim, fontWeight: 900 }}>
                      Distributor
                    </div>
                    <input
                      value={communityDistributorInput}
                      onChange={(e) =>
                        setCommunityDistributorInput(e.target.value)
                      }
                      style={inputStyle()}
                      placeholder="0x..."
                    />
                    <button
                      style={smallBtn(true)}
                      disabled={
                        !canWriteCommunity || !!pending.community_setDistributor
                      }
                      onClick={() =>
                        canWriteCommunity && setCommunityDistributorAddress()
                      }
                    >
                      {pending.community_setDistributor
                        ? "Saving..."
                        : "Set distributor"}
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ color: C.dim, fontWeight: 900 }}>
                      Pool top-up
                    </div>
                    <input
                      value={communityDepositAmount}
                      onChange={(e) =>
                        setCommunityDepositAmount(e.target.value)
                      }
                      style={inputStyle()}
                      placeholder="POL amount"
                    />
                    <button
                      style={smallBtn(true)}
                      disabled={
                        !canWriteCommunity || !!pending.community_ownerDeposit
                      }
                      onClick={() =>
                        canWriteCommunity && depositCommunityPool()
                      }
                    >
                      {pending.community_ownerDeposit
                        ? "Depositing..."
                        : "Owner deposit"}
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ color: C.dim, fontWeight: 900 }}>
                      Pause control
                    </div>
                    <div style={{ color: C.dim, fontSize: "0.9rem" }}>
                      Current state: {communityPaused ? "Paused" : "Active"}
                    </div>
                    <button
                      style={smallBtn(!communityPaused)}
                      disabled={
                        !canWriteCommunity || !!pending.community_pauseToggle
                      }
                      onClick={() =>
                        canWriteCommunity && toggleCommunityPause()
                      }
                    >
                      {pending.community_pauseToggle
                        ? "Submitting..."
                        : communityPaused
                          ? "Unpause contract"
                          : "Pause contract"}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 16,
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  }}
                >
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ color: C.dim, fontWeight: 900 }}>
                      Rescue free pool
                    </div>
                    <input
                      value={communityRescueTo}
                      onChange={(e) => setCommunityRescueTo(e.target.value)}
                      style={inputStyle()}
                      placeholder="Recipient address"
                    />
                    <input
                      value={communityRescueAmount}
                      onChange={(e) => setCommunityRescueAmount(e.target.value)}
                      style={inputStyle()}
                      placeholder="POL amount"
                    />
                    <button
                      style={smallBtn(true)}
                      disabled={
                        !canWriteCommunity || !!pending.community_rescuePool
                      }
                      onClick={() => canWriteCommunity && rescueCommunityPool()}
                    >
                      {pending.community_rescuePool
                        ? "Sending..."
                        : "Rescue pool"}
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ color: C.dim, fontWeight: 900 }}>
                      Emergency withdraw
                    </div>
                    <div style={{ color: C.dim, fontSize: "0.9rem" }}>
                      Available only while paused. Sends contract free balance
                      to the target address.
                    </div>
                    <input
                      value={communityEmergencyTo}
                      onChange={(e) => setCommunityEmergencyTo(e.target.value)}
                      style={inputStyle()}
                      placeholder="Recipient address"
                    />
                    <button
                      style={smallBtn(true)}
                      disabled={
                        !canWriteCommunity ||
                        !communityPaused ||
                        !!pending.community_emergencyWithdraw
                      }
                      onClick={() =>
                        canWriteCommunity && emergencyWithdrawCommunity()
                      }
                    >
                      {pending.community_emergencyWithdraw
                        ? "Withdrawing..."
                        : "Emergency withdraw"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {(activeTab === "POLICY" || activeTab === "community") && (
          <div
            className="admin-panel__section-block"
            style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}
          >
            <section
              style={{
                ...card,
                display: activeTab === "POLICY" ? undefined : "none",
              }}
            >
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  POLICY Controls
                </h3>
              </div>
              <div style={{ padding: 12, display: "grid", gap: 16 }}>
                <div
                  style={{ color: C.dim, fontWeight: 900, marginBottom: 10 }}
                >
                  POLICY Splits
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr) auto",
                    gap: 8,
                  }}
                >
                  <input
                    value={alphaBUYBACK}
                    onChange={(e) => setAlphaBUYBACK(e.target.value)}
                    style={inputStyle()}
                    placeholder="alphaBUYBACK bps"
                  />
                  <input
                    value={betaBurn}
                    onChange={(e) => setBetaBurn(e.target.value)}
                    style={inputStyle()}
                    placeholder="betaBurn bps"
                  />
                  <input
                    value={gammaStaking}
                    onChange={(e) => setGammaStaking(e.target.value)}
                    style={inputStyle()}
                    placeholder="gammaStaking bps"
                  />
                  <button
                    style={smallBtn(true)}
                    disabled={!!pending.pol_setSplits}
                    onClick={() =>
                      run(
                        "pol_setSplits",
                        () =>
                          actions.pol_setSplits &&
                          actions.pol_setSplits(
                            Number(alphaBUYBACK),
                            Number(betaBurn),
                            Number(gammaStaking),
                          ),
                      )
                    }
                  >
                    {pending.pol_setSplits ? "Saving..." : "Set Splits"}
                  </button>
                </div>

                <div
                  style={{
                    color: C.dim,
                    fontWeight: 900,
                    margin: "14px 0 10px",
                  }}
                >
                  POLICY Guards
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr) auto",
                    gap: 8,
                  }}
                >
                  <input
                    value={gSwapSlip}
                    onChange={(e) => setGSwapSlip(e.target.value)}
                    style={inputStyle()}
                    placeholder="swapSlip bps"
                  />
                  <input
                    value={gLpSlip}
                    onChange={(e) => setGLpSlip(e.target.value)}
                    style={inputStyle()}
                    placeholder="lpSlip bps"
                  />
                  <input
                    value={gDeadline}
                    onChange={(e) => setGDeadline(e.target.value)}
                    style={inputStyle()}
                    placeholder="deadline s"
                  />
                  <input
                    value={gCooldown}
                    onChange={(e) => setGCooldown(e.target.value)}
                    style={inputStyle()}
                    placeholder="cooldown s"
                  />
                  <input
                    value={gEpsBand}
                    onChange={(e) => setGEpsBand(e.target.value)}
                    style={inputStyle()}
                    placeholder="epsBand bps"
                  />
                  <input
                    value={gTwapWindow}
                    onChange={(e) => setGTwapWindow(e.target.value)}
                    style={inputStyle()}
                    placeholder="twapWindow s"
                  />
                  <input
                    value={gDailyCap}
                    onChange={(e) => setGDailyCap(e.target.value)}
                    style={inputStyle()}
                    placeholder="dailyCap native"
                  />
                  <button
                    style={smallBtn(true)}
                    disabled={!!pending.pol_setGuards}
                    onClick={() =>
                      run(
                        "pol_setGuards",
                        () =>
                          actions.pol_setGuards &&
                          actions.pol_setGuards({
                            swapSlip: Number(gSwapSlip),
                            lpSlip: Number(gLpSlip),
                            deadlineSec: Number(gDeadline),
                            cooldownSec: Number(gCooldown),
                            epsBandBps: Number(gEpsBand),
                            twapWindowSec: Number(gTwapWindow),
                            dailyCapNative: gDailyCap,
                          }),
                      )
                    }
                  >
                    {pending.pol_setGuards ? "Saving..." : "Set Guards"}
                  </button>
                </div>

                <div
                  style={{
                    color: C.dim,
                    fontWeight: 900,
                    margin: "14px 0 10px",
                  }}
                >
                  POLICY Pauses
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr) auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={pauseBUYBACKs}
                      onChange={(e) => setPauseBUYBACKs(e.target.checked)}
                    />{" "}
                    BUYBACKs
                  </label>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={pauseRefills}
                      onChange={(e) => setPauseRefills(e.target.checked)}
                    />{" "}
                    Refills
                  </label>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={pauseLpAdds}
                      onChange={(e) => setPauseLpAdds(e.target.checked)}
                    />{" "}
                    LP Adds
                  </label>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={pauseEoc}
                      onChange={(e) => setPauseEoc(e.target.checked)}
                    />{" "}
                    End Of COLLECTION
                  </label>
                  <button
                    style={smallBtn(true)}
                    disabled={!!pending.pol_setPauses}
                    onClick={() =>
                      run(
                        "pol_setPauses",
                        () =>
                          actions.pol_setPauses &&
                          actions.pol_setPauses({
                            BUYBACKs: pauseBUYBACKs,
                            refills: pauseRefills,
                            lpAdds: pauseLpAdds,
                            eoc: pauseEoc,
                          }),
                      )
                    }
                  >
                    {pending.pol_setPauses ? "Saving..." : "Set Pauses"}
                  </button>
                </div>

                <div
                  style={{
                    color: C.dim,
                    fontWeight: 900,
                    margin: "14px 0 10px",
                  }}
                >
                  POLICY Operators & Daily
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 0.6fr auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    value={opAddress}
                    onChange={(e) => setOpAddress(e.target.value)}
                    style={inputStyle(true)}
                    placeholder="Operator address"
                  />
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={opAllowed}
                      onChange={(e) => setOpAllowed(e.target.checked)}
                    />{" "}
                    Allowed
                  </label>
                  <button
                    style={smallBtn(true)}
                    disabled={!!pending.pol_setOperator}
                    onClick={() =>
                      run(
                        "pol_setOperator",
                        () =>
                          actions.pol_setOperator &&
                          actions.pol_setOperator(opAddress, !!opAllowed),
                      )
                    }
                  >
                    {pending.pol_setOperator ? "Saving..." : "Set Operator"}
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <input
                    value={dailyConsumeAmt}
                    onChange={(e) => setDailyConsumeAmt(e.target.value)}
                    style={inputStyle()}
                    placeholder="Consume daily quota (native)"
                  />
                  <button
                    style={smallBtn(false)}
                    disabled={!!pending.pol_consumeDaily}
                    onClick={() =>
                      run(
                        "pol_consumeDaily",
                        () =>
                          actions.pol_consumeDaily &&
                          actions.pol_consumeDaily(dailyConsumeAmt),
                      )
                    }
                  >
                    {pending.pol_consumeDaily ? "Consuming..." : "Consume"}
                  </button>
                  <button
                    style={smallBtn(true)}
                    disabled={!!pending.pol_resetDaily}
                    onClick={() =>
                      run(
                        "pol_resetDaily",
                        () =>
                          actions.pol_resetDailyCounter &&
                          actions.pol_resetDailyCounter(),
                      )
                    }
                  >
                    {pending.pol_resetDaily ? "Resetting..." : "Reset Daily"}
                  </button>
                </div>
              </div>
            </section>

            <section
              style={{
                ...card,
                display: activeTab === "community" ? undefined : "none",
              }}
            >
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  Community Voting
                </h3>
                <button
                  style={smallBtn(false)}
                  disabled={!!pending.community_poll_refresh}
                  onClick={() =>
                    run("community_poll_refresh", async () => {
                      await loadCommunityPolls();
                    })
                  }
                >
                  {pending.community_poll_refresh
                    ? "Refreshing..."
                    : "Refresh polls"}
                </button>
              </div>
              <div style={{ padding: 12, display: "grid", gap: 12 }}>
                <p style={{ margin: 0, color: C.dim }}>
                  Create and manage wallet-signed community polls that show in
                  the user-facing Community Center next to events. This voting
                  layer is off-chain and is not stored in the current Community
                  Center contract.
                </p>

                {communityPollsError ? (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${C.line}`,
                      background: "rgba(255, 88, 88, 0.14)",
                      color: "#ffb3b3",
                    }}
                  >
                    {communityPollsError}
                  </div>
                ) : null}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(180px, 1fr) minmax(180px, 1fr)",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <span style={{ color: C.dim, fontWeight: 900 }}>
                      Poll ID (optional)
                    </span>
                    <input
                      value={communityPollId}
                      onChange={(e) => setCommunityPollId(e.target.value)}
                      style={inputStyle()}
                      placeholder="Leave empty to create a new poll"
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <span style={{ color: C.dim, fontWeight: 900 }}>
                      Linked event ID (optional)
                    </span>
                    <input
                      value={communityPollEventId}
                      onChange={(e) => setCommunityPollEventId(e.target.value)}
                      style={inputStyle()}
                      placeholder="Event ID shown on the poll card"
                    />
                  </div>
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span style={{ color: C.dim, fontWeight: 900 }}>
                    Poll title
                  </span>
                  <input
                    value={communityPollTitle}
                    onChange={(e) => setCommunityPollTitle(e.target.value)}
                    style={inputStyle()}
                    placeholder="Short voting question shown to users"
                  />
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span style={{ color: C.dim, fontWeight: 900 }}>
                    Description for users
                  </span>
                  <textarea
                    value={communityPollDescription}
                    onChange={(e) =>
                      setCommunityPollDescription(e.target.value)
                    }
                    style={{
                      ...inputStyle(),
                      minHeight: 80,
                      resize: "vertical",
                    }}
                    placeholder="Explain what the vote is about and what the choice means"
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <span style={{ color: C.dim, fontWeight: 900 }}>
                      Poll start
                    </span>
                    <input
                      type="datetime-local"
                      value={communityPollStartsAt}
                      onChange={(e) => setCommunityPollStartsAt(e.target.value)}
                      style={inputStyle()}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <span style={{ color: C.dim, fontWeight: 900 }}>
                      Poll end
                    </span>
                    <input
                      type="datetime-local"
                      value={communityPollEndsAt}
                      onChange={(e) => setCommunityPollEndsAt(e.target.value)}
                      style={inputStyle()}
                    />
                  </div>
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span style={{ color: C.dim, fontWeight: 900 }}>
                    Vote options (one per line)
                  </span>
                  <textarea
                    value={communityPollOptions}
                    onChange={(e) => setCommunityPollOptions(e.target.value)}
                    style={{
                      ...inputStyle(),
                      minHeight: 96,
                      resize: "vertical",
                    }}
                    placeholder={"Yes\nNo"}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    style={smallBtn(false)}
                    onClick={clearCommunityPollForm}
                  >
                    Clear poll form
                  </button>
                  <button
                    style={smallBtn(true)}
                    disabled={
                      !adminAccess.canWrite || !!pending.community_poll_save
                    }
                    onClick={saveCommunityPoll}
                  >
                    {pending.community_poll_save
                      ? "Saving..."
                      : communityPollId
                        ? "Save poll"
                        : "Create poll"}
                  </button>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ color: C.dim, fontWeight: 900 }}>
                    Existing polls
                  </div>
                  {!communityPolls.length ? (
                    <div style={{ color: C.dim }}>No polls created yet.</div>
                  ) : (
                    communityPolls.map((poll) => (
                      <div
                        key={poll.id}
                        style={{
                          display: "grid",
                          gap: 8,
                          padding: 12,
                          borderRadius: 12,
                          border: `1px solid ${C.line}`,
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,.035), rgba(0,0,0,.16))",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "grid", gap: 4 }}>
                            <strong>{poll.title || poll.id}</strong>
                            <span style={{ color: C.dim, fontSize: "0.9rem" }}>
                              {poll.id}
                              {poll.linkedEventId != null
                                ? ` · Event #${poll.linkedEventId}`
                                : ""}
                            </span>
                          </div>
                          <span style={pill}>
                            {poll.status || "Live"} ·{" "}
                            {Number(poll.totalVotes || 0)} votes
                          </span>
                        </div>
                        {poll.description ? (
                          <div style={{ color: C.dim }}>{poll.description}</div>
                        ) : null}
                        <div style={{ color: C.dim, fontSize: "0.9rem" }}>
                          {poll.startsAt
                            ? `Opens: ${new Date(poll.startsAt).toLocaleString()}`
                            : "Opens: --"}
                          {" · "}
                          {poll.endsAt
                            ? `Closes: ${new Date(poll.endsAt).toLocaleString()}`
                            : "Closes: --"}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            style={smallBtn(false)}
                            onClick={() => loadCommunityPollIntoForm(poll)}
                          >
                            Load to form
                          </button>
                          {poll.status !== "Closed" ? (
                            <button
                              style={smallBtn(true)}
                              disabled={
                                !adminAccess.canWrite ||
                                !!pending[`community_poll_close_${poll.id}`]
                              }
                              onClick={() => closeCommunityPoll(poll.id)}
                            >
                              {pending[`community_poll_close_${poll.id}`]
                                ? "Closing..."
                                : "Close now"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "community" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
            <section style={{ ...card }}>
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  Community Center Events
                </h3>
              </div>
              <div style={{ padding: 12, display: "grid", gap: 12 }}>
                <p style={{ margin: 0, color: C.dim }}>
                  Create new on-chain community events, or load an existing
                  event into the form for inspection and reuse. Timestamps are
                  unix seconds. At least one winner is required and every winner
                  must have a matching POL amount.
                </p>
                <div style={{ margin: 0, color: C.dim, fontSize: "0.92rem" }}>
                  For simple content, write `Description` and optional `Image
                  URI` directly below. If `IPFS metadata` is left empty, the
                  panel will store this metadata inline so it still shows to
                  users without a separate IPFS upload.
                </div>
                {!communityAvailable && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${C.line}`,
                      background: "rgba(255, 88, 88, 0.14)",
                      color: "#ffb3b3",
                    }}
                  >
                    Community Center is missing from the active deployment
                    configuration. Event editing is disabled.
                  </div>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(160px, 1fr) auto",
                    gap: 8,
                  }}
                >
                  <input
                    value={eventId}
                    onChange={(e) => setEventId(e.target.value)}
                    style={inputStyle()}
                    placeholder="Event ID (for load)"
                  />
                  <button
                    style={smallBtn(true)}
                    disabled={
                      !communityAvailable ||
                      !!pending.community_loadEvent ||
                      !String(eventId).trim()
                    }
                    onClick={() => communityAvailable && loadCommunityEvent()}
                  >
                    {pending.community_loadEvent ? "Loading..." : "Load"}
                  </button>
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span style={{ color: C.dim, fontWeight: 900 }}>Title</span>
                  <input
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="Short on-chain title shown in Community Center"
                    style={inputStyle()}
                  />
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span style={{ color: C.dim, fontWeight: 900 }}>
                    Description for users
                  </span>
                  <textarea
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    placeholder="Short text shown on the event card in Community Center"
                    style={{
                      ...inputStyle(),
                      minHeight: 80,
                      resize: "vertical",
                    }}
                  />
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span style={{ color: C.dim, fontWeight: 900 }}>
                    Image URI (optional)
                  </span>
                  <input
                    value={eventImage}
                    onChange={(e) => setEventImage(e.target.value)}
                    placeholder="ipfs://..., https://..., or leave empty"
                    style={inputStyle()}
                  />
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span style={{ color: C.dim, fontWeight: 900 }}>
                    IPFS metadata URI (optional)
                  </span>
                  <textarea
                    value={eventIpfs}
                    onChange={(e) => setEventIpfs(e.target.value)}
                    placeholder="ipfs://... or CID. Leave empty to use the fields above as inline metadata."
                    style={{
                      ...inputStyle(),
                      minHeight: 72,
                      resize: "vertical",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  }}
                >
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <span style={{ color: C.dim, fontWeight: 900 }}>
                      Start (unix sec)
                    </span>
                    <input
                      value={eventStart}
                      onChange={(e) => setEventStart(e.target.value)}
                      style={inputStyle()}
                      placeholder="e.g. 1709505600"
                    />
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <span style={{ color: C.dim, fontWeight: 900 }}>
                      End (unix sec)
                    </span>
                    <input
                      value={eventEnd}
                      onChange={(e) => setEventEnd(e.target.value)}
                      style={inputStyle()}
                      placeholder="e.g. 1709512800"
                    />
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <span style={{ color: C.dim, fontWeight: 900 }}>
                      Total prize (POL)
                    </span>
                    <input
                      value={eventTotalPrize}
                      onChange={(e) => setEventTotalPrize(e.target.value)}
                      style={inputStyle()}
                      placeholder="Leave empty to sum amounts"
                    />
                  </div>
                </div>

                <div
                  style={{ marginTop: -6, color: C.dim, fontSize: "0.9rem" }}
                >
                  Contract rule: no empty winner list, matching winner and
                  amount counts, and end timestamp must be later than start.
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  }}
                >
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <span style={{ color: C.dim, fontWeight: 900 }}>
                      Winners (one per line)
                    </span>
                    <textarea
                      value={eventWinners}
                      onChange={(e) => setEventWinners(e.target.value)}
                      placeholder={"0x...\n0x..."}
                      style={{
                        ...inputStyle(),
                        minHeight: 96,
                        resize: "vertical",
                      }}
                    />
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <span style={{ color: C.dim, fontWeight: 900 }}>
                      Amounts (POL, one per line)
                    </span>
                    <textarea
                      value={eventAmounts}
                      onChange={(e) => setEventAmounts(e.target.value)}
                      placeholder={"0.5\n0.25"}
                      style={{
                        ...inputStyle(),
                        minHeight: 96,
                        resize: "vertical",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    style={smallBtn(false)}
                    onClick={clearCommunityEventForm}
                  >
                    Clear form
                  </button>
                  <button
                    style={smallBtn(true)}
                    disabled={
                      !communityAvailable ||
                      !canWriteCommunity ||
                      !!pending.community_createEvent ||
                      !eventTitle.trim()
                    }
                    onClick={() => canWriteCommunity && createCommunityEvent()}
                  >
                    {pending.community_createEvent
                      ? "Creating..."
                      : "Create event"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "nft" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
            <section style={{ ...card }}>
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  NFT REWARDS
                </h3>
              </div>
              <div style={{ padding: 12, display: "grid", gap: 12 }}>
                <p style={{ margin: 0, color: C.dim }}>
                  Manual REWARDS and mystery events only. Character REWARDS are
                  handled by the main contract.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    value={nftMainContract}
                    onChange={(e) => setNftMainContract(e.target.value)}
                    style={inputStyle(true)}
                    placeholder="Main contract address"
                  />
                  <button
                    style={smallBtn(true)}
                    disabled={!!pending.nft_setMain}
                    onClick={applyNftMainContract}
                  >
                    {pending.nft_setMain ? "Saving..." : "Set main"}
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    value={nftVRFRouter}
                    onChange={(e) => setNftVRFRouter(e.target.value)}
                    style={inputStyle(true)}
                    placeholder="VRF router address"
                  />
                  <button
                    style={smallBtn(true)}
                    disabled={!!pending.nft_setVRF}
                    onClick={applyNftVRFRouter}
                  >
                    {pending.nft_setVRF ? "Saving..." : "Set VRF"}
                  </button>
                </div>

                <div
                  style={{
                    borderTop: `1px dashed ${C.line}`,
                    paddingTop: 12,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ color: C.dim, fontWeight: 900 }}>
                    Manual reward
                  </div>
                  <input
                    value={nftManualWinner}
                    onChange={(e) => setNftManualWinner(e.target.value)}
                    style={inputStyle(true)}
                    placeholder="Winner address"
                  />
                  <input
                    value={nftManualUri}
                    onChange={(e) => setNftManualUri(e.target.value)}
                    style={inputStyle()}
                    placeholder="Token URI (ipfs://...)"
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      style={smallBtn(true)}
                      disabled={!!pending.nft_manual}
                      onClick={createNftManualReward}
                    >
                      {pending.nft_manual
                        ? "Creating..."
                        : "Create manual reward"}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: `1px dashed ${C.line}`,
                    paddingTop: 12,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ color: C.dim, fontWeight: 900 }}>
                    Mystery event
                  </div>
                  <textarea
                    value={nftMysteryUris}
                    onChange={(e) => setNftMysteryUris(e.target.value)}
                    placeholder="Token URIs (one per line or comma separated)"
                    style={{
                      ...inputStyle(),
                      minHeight: 88,
                      resize: "vertical",
                    }}
                  />
                  <textarea
                    value={nftMysteryEligible}
                    onChange={(e) => setNftMysteryEligible(e.target.value)}
                    placeholder="Eligible addresses (one per line or comma separated)"
                    style={{
                      ...inputStyle(true),
                      minHeight: 88,
                      resize: "vertical",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      style={smallBtn(true)}
                      disabled={!!pending.nft_mystery}
                      onClick={createNftMysteryEvent}
                    >
                      {pending.nft_mystery
                        ? "Creating..."
                        : "Create mystery event"}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: `1px dashed ${C.line}`,
                    paddingTop: 12,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ color: C.dim, fontWeight: 900 }}>
                    Request mystery randomness
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      value={nftMysteryEventId}
                      onChange={(e) => setNftMysteryEventId(e.target.value)}
                      style={inputStyle()}
                      placeholder="Event ID"
                    />
                    <button
                      style={smallBtn(true)}
                      disabled={!!pending.nft_request}
                      onClick={requestNftMysteryRandom}
                    >
                      {pending.nft_request ? "Requesting..." : "Request random"}
                    </button>
                  </div>
                </div>

                {(nftLastEventId || nftLastRewardId || nftLastRequestId) && (
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      color: C.dim,
                    }}
                  >
                    {nftLastEventId && (
                      <span>Last event ID: {nftLastEventId}</span>
                    )}
                    {nftLastRewardId && (
                      <span>Last reward ID: {nftLastRewardId}</span>
                    )}
                    {nftLastRequestId && (
                      <span>Last request ID: {nftLastRequestId}</span>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "chat" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 18,
            }}
          >
            <section style={{ ...card }}>
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  Live Chat Rules
                </h3>
              </div>
              <div style={{ padding: 12, display: "grid", gap: 10 }}>
                <div style={{ color: C.dim, fontWeight: 900 }}>
                  Current rules
                </div>
                <div
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${C.line}`,
                    padding: "10px 12px",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.18))",
                    color: C.text,
                    minHeight: 56,
                  }}
                >
                  {chatRules || "No rules loaded."}
                </div>
                <textarea
                  value={chatRulesDraft}
                  onChange={(e) => setChatRulesDraft(e.target.value)}
                  placeholder="Update rules text"
                  style={{ ...inputStyle(), minHeight: 96, resize: "vertical" }}
                />
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                  }}
                >
                  <button
                    style={smallBtn(false)}
                    disabled={chatLoading}
                    onClick={loadChatAdmin}
                  >
                    {chatLoading ? "Refreshing..." : "Refresh"}
                  </button>
                  <button
                    style={smallBtn(true)}
                    disabled={
                      !adminAccess.canWrite || !!pending.chat_rules_update
                    }
                    onClick={updateChatRules}
                  >
                    {pending.chat_rules_update ? "Saving..." : "Update Rules"}
                  </button>
                </div>
                {chatError && (
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: `1px solid ${C.line}`,
                      background: "rgba(255, 88, 88, 0.14)",
                      color: "#ffb3b3",
                    }}
                  >
                    {chatError}
                  </div>
                )}
              </div>
            </section>

            <section style={{ ...card }}>
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  Moderation
                </h3>
              </div>
              <div style={{ padding: 12, display: "grid", gap: 10 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <input
                    value={chatMessageId}
                    onChange={(e) => setChatMessageId(e.target.value)}
                    style={inputStyle()}
                    placeholder="Message ID"
                  />
                  <select
                    value={chatAction}
                    onChange={(e) => setChatAction(e.target.value)}
                    style={inputStyle()}
                  >
                    <option value="soft-delete">Soft delete</option>
                    <option value="edit">Edit</option>
                  </select>
                </div>
                <textarea
                  value={chatNewContent}
                  onChange={(e) => setChatNewContent(e.target.value)}
                  placeholder="New content (edit only)"
                  style={{
                    ...inputStyle(),
                    minHeight: 88,
                    resize: "vertical",
                    opacity: chatAction === "edit" ? 1 : 0.6,
                  }}
                  disabled={chatAction !== "edit"}
                />
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    style={smallBtn(false)}
                    onClick={() => {
                      setChatMessageId("");
                      setChatNewContent("");
                    }}
                  >
                    Clear
                  </button>
                  <button
                    style={smallBtn(true)}
                    disabled={!adminAccess.canWrite || !!pending.chat_moderate}
                    onClick={applyChatModeration}
                  >
                    {pending.chat_moderate ? "Applying..." : "Apply"}
                  </button>
                </div>
              </div>
            </section>

            <section style={{ ...card, gridColumn: "1 / -1" }}>
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  Recent Messages
                </h3>
                <button
                  style={smallBtn(false)}
                  disabled={chatLoading}
                  onClick={loadChatAdmin}
                >
                  {chatLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
              <div style={{ padding: 12 }}>
                {chatLoading && (
                  <div style={{ color: C.dim }}>Loading messages...</div>
                )}
                {!chatLoading && chatMessages.length === 0 && (
                  <div style={{ color: C.dim }}>No messages found.</div>
                )}
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    maxHeight: 360,
                    overflow: "auto",
                  }}
                >
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${C.line}`,
                        padding: "10px 12px",
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.18))",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div style={{ color: C.dim, fontWeight: 800 }}>
                          #{msg.id} {short(msg.author_address)}
                          {msg.author_name ? ` (${msg.author_name})` : ""}
                        </div>
                        <div style={{ color: C.dim }}>
                          {formatChatTime(msg.created_at)}
                        </div>
                      </div>
                      <div style={{ color: msg.deleted ? "#ffb3b3" : C.text }}>
                        {msg.deleted ? "Message removed" : msg.content}
                      </div>
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <button
                          style={smallBtn(false)}
                          onClick={() => pickChatMessage(msg, "soft-delete")}
                        >
                          Pick delete
                        </button>
                        <button
                          style={smallBtn(true)}
                          onClick={() => pickChatMessage(msg, "edit")}
                        >
                          Pick edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "health" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
            <section style={{ ...card }}>
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  Network Health
                </h3>
                <button
                  style={smallBtn(false)}
                  disabled={healthLoading}
                  onClick={loadHealth}
                >
                  {healthLoading ? "Checking..." : "Refresh"}
                </button>
              </div>
              <div style={{ padding: 12, display: "grid", gap: 12 }}>
                {healthError && (
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: `1px solid ${C.line}`,
                      background: "rgba(255, 88, 88, 0.14)",
                      color: "#ffb3b3",
                    }}
                  >
                    {healthError}
                  </div>
                )}
                <KV
                  items={[
                    {
                      k: "RPC URL",
                      v: rpcSnapshot?.rpcUrl || "--",
                      mono: true,
                      copy: rpcSnapshot?.rpcUrl || undefined,
                    },
                    { k: "Chain ID", v: rpcSnapshot?.chainId ?? "--" },
                    { k: "Network", v: rpcSnapshot?.name ?? "--" },
                    { k: "Block Number", v: rpcSnapshot?.blockNumber ?? "--" },
                    {
                      k: "Latency",
                      v:
                        rpcSnapshot?.latencyMs != null
                          ? `${rpcSnapshot.latencyMs} ms`
                          : "--",
                    },
                    { k: "Last Checked", v: rpcSnapshot?.lastChecked || "--" },
                    {
                      k: "DEX liquidity",
                      v:
                        dexSnapshot?.status === "seeded"
                          ? "SEEDED"
                          : dexSnapshot?.status === "awaiting-liquidity"
                            ? "AWAITING INITIAL LIQUIDITY (PRE-LAUNCH)"
                            : dexSnapshot?.status === "partial"
                              ? "PARTIAL RESERVES - ACTION REQUIRED"
                              : dexSnapshot?.status === "error"
                                ? `READ ERROR: ${dexSnapshot.error || "unknown"}`
                                : "--",
                    },
                    {
                      k: "BIGGI pair reserve",
                      v:
                        dexSnapshot?.biggiReserve == null
                          ? "--"
                          : `${dexSnapshot.biggiReserve} BIGGI`,
                    },
                    {
                      k: "WPOL pair reserve",
                      v:
                        dexSnapshot?.quoteReserve == null
                          ? "--"
                          : `${dexSnapshot.quoteReserve} WPOL`,
                    },
                  ]}
                />
              </div>
            </section>

            <section style={{ ...card }}>
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  Contract Status
                </h3>
              </div>
              <div
                className="admin-panel__table-scroll"
                style={{ padding: 12 }}
              >
                {healthLoading && (
                  <div style={{ color: C.dim }}>Checking contracts...</div>
                )}
                {!healthLoading && healthContracts.length === 0 && (
                  <div style={{ color: C.dim }}>No contracts configured.</div>
                )}
                {healthContracts.length > 0 && (
                  <table
                    className="admin-kv-table"
                    style={{
                      width: "100%",
                      borderCollapse: "separate",
                      borderSpacing: 0,
                    }}
                  >
                    <thead>
                      <tr>
                        {["Status", "Name", "Address", "Code / Error"].map(
                          (h, i, arr) => (
                            <th
                              key={h}
                              style={{
                                padding: "12px 14px",
                                color: C.y,
                                textAlign: "left",
                                borderBottom: `1px solid ${C.line}`,
                                position: "sticky",
                                top: 0,
                                zIndex: 1,
                                background:
                                  "linear-gradient(180deg, rgba(255,232,0,.18), rgba(255,232,0,.10))",
                                backdropFilter: "blur(4px)",
                                textShadow: "0 1px 0 rgba(0,0,0,.4)",
                                ...(i === 0 ? { borderTopLeftRadius: 12 } : {}),
                                ...(i === arr.length - 1
                                  ? { borderTopRightRadius: 12 }
                                  : {}),
                              }}
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody style={{ color: C.text }}>
                      {healthContracts.map((row, i) => {
                        const tone = healthTone(row.status);
                        return (
                          <tr
                            key={row.key || row.label || i}
                            style={{
                              borderBottom: `1px solid ${C.line}`,
                              background:
                                i % 2 === 0
                                  ? "linear-gradient(180deg, rgba(255,255,255,.02), rgba(0,0,0,.12))"
                                  : "linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.16))",
                            }}
                          >
                            <td style={{ padding: "10px 14px" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "4px 10px",
                                  borderRadius: 999,
                                  fontWeight: 900,
                                  fontSize: 12,
                                  color: tone.color,
                                  border: `1px solid ${tone.border}`,
                                  background: tone.bg,
                                }}
                              >
                                {tone.label}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                color: C.dim,
                                fontWeight: 800,
                              }}
                            >
                              {String(row.label || "").replaceAll("_", " ")}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                fontFamily:
                                  "ui-monospace, Menlo, Consolas, monospace",
                              }}
                              title={row.address || ""}
                            >
                              {row.address ? short(row.address) : "--"}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                fontFamily:
                                  "ui-monospace, Menlo, Consolas, monospace",
                                color:
                                  row.status === "error" ? "#ffb3b3" : C.text,
                              }}
                            >
                              {row.error || row.code || "--"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "frontend" && data?.frontend && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
            <section style={{ ...card }}>
              <div style={{ ...header, borderBottom: `1px solid ${C.line}` }}>
                <h3
                  style={{
                    margin: 0,
                    color: C.y,
                    textShadow: "0 0 10px rgba(255,232,0,.35)",
                  }}
                >
                  Frontend Info
                </h3>
              </div>
              <div style={{ padding: 12 }}>
                <KV
                  items={[
                    { k: "App", v: data.frontend.app },
                    { k: "React", v: data.frontend.react },
                    { k: "Network", v: data.frontend.network },
                    {
                      k: "Wallet",
                      v: short(data.frontend.wallet),
                      mono: true,
                      copy: data.frontend.wallet,
                    },
                    { k: "Screen", v: data.frontend.screen },
                    {
                      k: "User Agent",
                      v: data.frontend.userAgent,
                      mono: true,
                      copy: data.frontend.userAgent,
                    },
                    { k: "Last Refresh", v: data.frontend.lastRefreshAt },
                  ]}
                />
              </div>
            </section>
          </div>
        )}

        {/* Spacer for bottom breathing room */}
        <div style={{ height: 12 }} />
      </div>

      {/* Local table styles to mirror VRF/Biggi look */}
      <style>{`
        .admin-kv-table thead th,
        .admin-blocks-table thead th { font-weight: 900; }
        .admin-kv-table tbody tr:hover,
        .admin-blocks-table tbody tr:hover {
          background: linear-gradient(180deg, rgba(255,232,0,.10), rgba(255,232,0,.06));
        }
      `}</style>
    </div>
  );
}

/* Helpers */
function inputStyle(mono = false) {
  return {
    flex: 1,
    minWidth: 0,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,232,0,.22)",
    background:
      "linear-gradient(180deg, rgba(18,18,22,.95), rgba(12,12,16,.95))",
    color: "#f2f2f2",
    outline: "none",
    boxShadow: "inset 0 0 12px rgba(255,232,0,.06)",
    fontFamily: mono ? "ui-monospace, Menlo, Consolas, monospace" : "inherit",
  };
}

function short(v) {
  return typeof v === "string" && v.length > 12
    ? v.slice(0, 6) + "…" + v.slice(-4)
    : v || "—";
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : "—";
}

function shortErr(e) {
  const msg =
    (e && (e.reason || e.message || e.data?.message || e.toString())) ||
    "Error";
  return String(msg).replace(/\n/g, " ").slice(0, 160);
}

function copyToClipboard(text) {
  if (!text) return;
  try {
    navigator.clipboard?.writeText(text);
  } catch {}
}
