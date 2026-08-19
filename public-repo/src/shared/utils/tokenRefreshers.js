import { Contract } from "ethers";
import { formatEther } from "ethers";
import TreasuryService from "../services/treasuryService";
import { parseIdsCsv } from "./ids";
import { ADDR } from "./addresses";
import {
  getLiquidityHelperReaderRO,
  getReserveTreasurySnapshotRO,
  getMCDReaderV2RO,
} from "./contract";
import {
  getDistributorGlobalSnapshot,
  getDistributorPendingCommunity,
  getDistributorPendingOf,
} from "@/shared/services/tokenomics/distributorReaderCompat.js";

export const ABI_RESERVE = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32",
        name: "bucket",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "waitingBal",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "refillBal",
        type: "uint256",
      },
    ],
    name: "BiggiNotified",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "address", name: "lm", type: "address" },
    ],
    name: "LMSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "MintShareFromDistributor",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferStarted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "Paused",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "biggiAmt",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "maticAmt",
        type: "uint256",
      },
      { indexed: false, internalType: "address", name: "to", type: "address" },
    ],
    name: "PulledToLM",
    type: "event",
  },
  { anonymous: false, inputs: [], name: "TopUpRequested", type: "event" },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "Unpaused",
    type: "event",
  },

  {
    inputs: [],
    name: "BIGGI",
    outputs: [{ internalType: "contract IERC20", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "DEX_REFILL",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "WAITING",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [],
    name: "acceptOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "biggiBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "dexRefillBiggi",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "liquidityManager",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "lmPullBiggiDexRefill",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address payable", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "lmPullMaticDexRefill",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "maticBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "bytes32", name: "bucket", type: "bytes32" },
    ],
    name: "onBiggiMintedToReserve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "pause",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "paused",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "pendingOwner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [],
    name: "receiveMintShare",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },

  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "requestTopUpToLM",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [{ internalType: "address", name: "lm", type: "address" }],
    name: "setLiquidityManager",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "totalMaticReceived",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "unpause",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "waitingBiggi",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  { stateMutability: "payable", type: "receive" },
];

export async function refreshRouterInfo({
  onRefreshPOLICY,
  setBiggiData,
}) {
  const helper = getLiquidityHelperReaderRO();
  const [ri, path, vaultInfo] = await Promise.all([
    helper.routerInfo(),
    helper.getSwapPath(),
    helper.vaultInfo?.(ADDR.PAIR).catch(() => null),
  ]);
  setBiggiData((prev) => ({
    ...prev,
    router: {
      routerAddress: ri?.[0],
      factory: ri?.[1],
      wrappedNative: ri?.[2],
      swapPath: Array.isArray(path) ? path : [],
    },
    liquidity: {
      ...prev.liquidity,
      pairWhitelisted:
        typeof vaultInfo?.pairWhitelisted === "boolean"
          ? vaultInfo.pairWhitelisted
          : prev?.liquidity?.pairWhitelisted,
      lpBalanceInVault: vaultInfo?.vaultLpBalance
        ? formatEther(vaultInfo.vaultLpBalance)
        : prev?.liquidity?.lpBalanceInVault,
    },
  }));
  try {
    await onRefreshPOLICY();
  } catch {
    // ignore POLICY refresh failure
  }
}

export async function refreshLiquidityPreview({
  setBiggiData,
}) {
  const helper = getLiquidityHelperReaderRO();
  const res = await helper.liquidityPreview(0n);
  const f = (v) => (v != null ? formatEther(v) : "0");
  setBiggiData((prev) => ({
    ...prev,
    liquidity: {
      ...prev.liquidity,
      useAmount: f(res?.[0]),
      previewAmountsOut: Array.isArray(res?.[1]) ? res[1] : [],
      contractEthBalance: f(res?.[2]),
      dexRefillBiggi: f(res?.[3]),
    },
  }));
}

export async function refreshBUYBACKInfo({
  getBUYBACKRO,
  getReadOnlyLiquidityContract,
  ERC20_MINI,
  setBiggiData,
}) {
  const b = await getBUYBACKRO();
  const [
    router,
    wrappedNative,
    POLICY,
    treasury,
    lastAt,
    slip,
    deadline,
    cooldown,
    autoEnabled,
    pausedFlag,
  ] = await Promise.all([
    b.router().catch(() => null),
    b.wrappedNative().catch(() => null),
    b.policy().catch(() => null),
    b.treasury().catch(() => null),
    b.lastBuybackAt().catch(() => 0),
    b.fallbackSwapSlippageBps?.().catch?.(() => null),
    b.fallbackTxDeadlineSec?.().catch?.(() => null),
    b.fallbackMinIntervalSec?.().catch?.(() => null),
    b.autoBuybackEnabled?.().catch?.(() => null),
    b.paused?.().catch?.(() => null),
  ]);

  let nativeBalFmt = null;
  let biggiBalFmt = null;
  try {
    const wei = await b.provider.getBalance(b.address);
    nativeBalFmt = formatEther(wei);
  } catch {
    // ignore balance fetch failure
  }
  try {
    const brl = await getReadOnlyLiquidityContract();
    const tokenAddr = await brl.tokenAddress().catch(() => null);
    if (tokenAddr) {
      const erc = new Contract(tokenAddr, ERC20_MINI, b.provider);
      const bal = await erc.balanceOf(b.address);
      biggiBalFmt = formatEther(bal);
    }
  } catch {
    // ignore token balance failure
  }

  setBiggiData((prev) => ({
    ...prev,
    BUYBACK: {
      router: router || prev?.router?.routerAddress || null,
      wrappedNative: wrappedNative || prev?.router?.wrappedNative || null,
      POLICY: POLICY || null,
      treasury: treasury || null,
      lastBUYBACKAt: Number(lastAt || 0),
      fallbackSlipBps: slip != null ? Number(slip) : null,
      fallbackDeadlineSec: deadline != null ? Number(deadline) : null,
      fallbackCooldownSec: cooldown != null ? Number(cooldown) : null,
      autoBUYBACKEnabled:
        autoEnabled != null ? !!autoEnabled : prev?.BUYBACK?.autoBUYBACKEnabled,
      paused: pausedFlag != null ? !!pausedFlag : prev?.BUYBACK?.paused,
      nativeBalance: nativeBalFmt ?? prev?.BUYBACK?.nativeBalance,
      biggiBalance: biggiBalFmt ?? prev?.BUYBACK?.biggiBalance,
    },
  }));
}

export async function fetchReserveInfo({
  contractRef,
  getReadOnlyContract,
  callFirst,
  setBiggiData,
}) {
  const main = contractRef.current || getReadOnlyContract();
  const reader = getReserveTreasurySnapshotRO(main?.provider);

  const reserveAddress =
    (await callFirst(main, ["reserve", "reserveAddress", "getReserve"])) ||
    ADDR.RESERVE ||
    null;

  const snap = await reader.reserveSnapshot();
  const payload = {
    reserveAddress,
    liquidityManager: ADDR.LM || "\u2014",
    totalMaticReceived: formatEther(snap?.totalReceivedPol || 0n),
    waitingBiggi: formatEther(snap?.waiting || 0n),
    dexRefillBiggi: formatEther(snap?.dexRefill || 0n),
    biggiBalance: formatEther(snap?.reserveBiggi || 0n),
    maticBalance: formatEther(snap?.reservePol || 0n),
  };

  setBiggiData((prev) => ({
    ...prev,
    reserve: { ...prev.reserve, ...payload },
  }));

  return payload;
}

export async function fetchTreasuryInfo({
  getReadOnlyLiquidityContract,
  callFirst,
  ERC20_MINI,
  setBiggiData,
}) {
  const brl = await getReadOnlyLiquidityContract();
  const provider = brl.provider;

  const treasuryAddr =
    (await callFirst(brl, ["treasury", "treasuryAddress", "getTreasury"])) ||
    null;

  const tokenAddr = await callFirst(brl, [
    "tokenAddress",
    "biggi",
    "getToken",
    "getBIGGI",
  ]);
  let tokenBalance = "\u2014";
  let nativeBalance = "\u2014";
  let totalBiggiReceived = "\u2014";
  let totalBiggiReceivedFromBUYBACK = "\u2014";
  let totalMaticReceived = "\u2014";
  let totalMaticReceivedFromDistributor = "\u2014";
  let biggiToken = tokenAddr || "\u2014";

  if (treasuryAddr) {
    try {
      const svc = new TreasuryService(treasuryAddr, provider);
      const stats = await svc.getAllStats();
      const summary = TreasuryService.formatSummary(stats);
      tokenBalance = summary.biggiBalance;
      nativeBalance = summary.maticBalanceEth;
      totalBiggiReceived = summary.totalBiggiReceived;
      totalBiggiReceivedFromBUYBACK = summary.totalBiggiReceivedFromBUYBACK;
      totalMaticReceived = summary.totalMaticReceived;
      totalMaticReceivedFromDistributor =
        summary.totalMaticReceivedFromDistributor;
      biggiToken = summary.biggiToken || biggiToken;
    } catch {
      // ignore treasury snapshot failure
    }
  }

  if (
    treasuryAddr &&
    (tokenBalance === "\u2014" || nativeBalance === "\u2014")
  ) {
    try {
      if (tokenAddr) {
        const erc20 = new Contract(tokenAddr, ERC20_MINI, provider);
        const bal = await erc20.balanceOf(treasuryAddr);
        tokenBalance = formatEther(bal);
      }
    } catch {
      // ignore token balance fallback
    }

    try {
      const wei = await provider.getBalance(treasuryAddr);
      nativeBalance = formatEther(wei);
    } catch {
      // ignore native balance fallback
    }
  }

  let lastRefillAt = "\u2014";
  try {
    const ts = await callFirst(brl, ["lastRefillAt", "treasuryLastRefillAt"]);
    if (ts) {
      const n = Number(ts.toString?.() || ts);
      if (Number.isFinite(n) && n > 0)
        lastRefillAt = new Date(n * 1000).toLocaleString();
    }
  } catch {
    // ignore lastRefillAt fetch
  }

  const payload = {
    treasuryAddress: treasuryAddr || "\u2014",
    nativeBalance,
    tokenBalance,
    biggiToken,
    totalBiggiReceived,
    totalBiggiReceivedFromBUYBACK,
    totalMaticReceived,
    totalMaticReceivedFromDistributor,
    lastRefillAt,
    notes: "On-chain snapshot (read-only).",
  };
  setBiggiData((prev) => ({
    ...prev,
    treasury: { ...(prev.treasury || {}), ...payload },
  }));

  return payload;
}

export async function refreshREWARDS({
  setBiggiData,
  walletAddress = null,
  tokenIdsCsv = "",
}) {
  const reader = getMCDReaderV2RO();
  const ids = parseIdsCsv(tokenIdsCsv);
  const [snap, pendingCommunity, pendingOfMe] = await Promise.all([
    getDistributorGlobalSnapshot(reader),
    getDistributorPendingCommunity(reader).catch(() => null),
    walletAddress
      ? getDistributorPendingOf(reader, [walletAddress]).catch(() => null)
      : Promise.resolve(null),
  ]);

  const snapshot = snap?.buybackAgent
    ? {
        buybackAgent: snap.buybackAgent,
        collectionRewards: snap.collectionRewards,
        reserve: snap.reserve,
        treasury: snap.treasury,
        communityCenter: snap.communityCenter,
        totalPending: formatEther(snap.totalPending || 0n),
        totalReceived: formatEther(snap.totalReceived || 0n),
      }
    : null;

  const claimPreview =
    pendingOfMe && pendingOfMe.length
      ? {
          units: "n/a",
          amount: `${formatEther(pendingOfMe[0] || 0)} BIGGI`,
        }
      : { units: "\u2014", amount: "\u2014" };

  setBiggiData((prev) => ({
    ...prev,
    REWARDS: {
      unitReward: "1 BIGGI",
      currentWeek: prev?.REWARDS?.currentWeek ?? "\u2014",
      blockWeights: prev?.REWARDS?.blockWeights,
      claimPreview,
      claimStatus: { tokenIds: ids.map((x) => x.toString()) },
      distributorSnapshot: snapshot || prev?.REWARDS?.distributorSnapshot,
      pendingCommunity:
        pendingCommunity != null
          ? formatEther(pendingCommunity)
          : prev?.REWARDS?.pendingCommunity,
    },
  }));
}



