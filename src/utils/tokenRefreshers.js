import { ethers } from "ethers";
import TreasuryService from "../services/treasuryService";
import { parseIdsCsv } from "./ids";

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
  getReadOnlyLiquidityContract,
  onRefreshPolicy,
  setBiggiData,
}) {
  const brl = await getReadOnlyLiquidityContract();
  const [ri, path] = await Promise.all([brl.routerInfo(), brl.getSwapPath()]);
  setBiggiData((prev) => ({
    ...prev,
    router: {
      routerAddress: ri?.[0],
      wrappedNative: ri?.[1],
      swapPath: Array.isArray(path) ? path : [],
    },
  }));
  try {
    await onRefreshPolicy();
  } catch {
    // ignore policy refresh failure
  }
}

export async function refreshLiquidityPreview({
  getReadOnlyLiquidityContract,
  setBiggiData,
}) {
  const brl = await getReadOnlyLiquidityContract();
  const res = await brl.liquidityPreview();
  const f = (v) => (v != null ? ethers.utils.formatEther(v) : "0");
  setBiggiData((prev) => ({
    ...prev,
    liquidity: {
      ...prev.liquidity,
      contractEthBalance: f(res?.[0]),
      lpBps: res?.[1]?.toString?.() ?? "\u2014",
      useAmount: f(res?.[2]),
      half: f(res?.[3]),
      otherHalf: f(res?.[4]),
    },
  }));
}

export async function refreshBuybackInfo({
  getBuybackRO,
  getReadOnlyLiquidityContract,
  ERC20_MINI,
  setBiggiData,
}) {
  const b = await getBuybackRO();
  const [
    router,
    wrappedNative,
    policy,
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
    b.buybacksPaused?.().catch?.(() => null),
  ]);

  let nativeBalFmt = null;
  let biggiBalFmt = null;
  try {
    const wei = await b.provider.getBalance(b.address);
    nativeBalFmt = ethers.utils.formatEther(wei);
  } catch {
    // ignore balance fetch failure
  }
  try {
    const brl = await getReadOnlyLiquidityContract();
    const tokenAddr = await brl.tokenAddress().catch(() => null);
    if (tokenAddr) {
      const erc = new ethers.Contract(tokenAddr, ERC20_MINI, b.provider);
      const bal = await erc.balanceOf(b.address);
      biggiBalFmt = ethers.utils.formatEther(bal);
    }
  } catch {
    // ignore token balance failure
  }

  setBiggiData((prev) => ({
    ...prev,
    buyback: {
      router: router || prev?.router?.routerAddress || null,
      wrappedNative: wrappedNative || prev?.router?.wrappedNative || null,
      policy: policy || null,
      treasury: treasury || null,
      lastBuybackAt: Number(lastAt || 0),
      fallbackSlipBps: slip != null ? Number(slip) : null,
      fallbackDeadlineSec: deadline != null ? Number(deadline) : null,
      fallbackCooldownSec: cooldown != null ? Number(cooldown) : null,
      autoBuybackEnabled:
        autoEnabled != null ? !!autoEnabled : prev?.buyback?.autoBuybackEnabled,
      paused: pausedFlag != null ? !!pausedFlag : prev?.buyback?.paused,
      nativeBalance: nativeBalFmt ?? prev?.buyback?.nativeBalance,
      biggiBalance: biggiBalFmt ?? prev?.buyback?.biggiBalance,
    },
  }));
}

export async function fetchReserveInfo({
  contractRef,
  getReadOnlyContract,
  callFirst,
  setBiggiData,
  ZERO_ADDRESS,
}) {
  const main = contractRef.current || getReadOnlyContract();
  const provider = main.provider;

  const reserveAddress = await callFirst(main, [
    "reserve",
    "reserveAddress",
    "getReserve",
  ]);
  if (!reserveAddress || reserveAddress === ZERO_ADDRESS) {
    return {};
  }

  const reserveContract = new ethers.Contract(
    reserveAddress,
    ABI_RESERVE,
    provider,
  );

  const [
    liquidityManager,
    totalMaticReceived,
    waitingBiggi,
    dexRefillBiggi,
    biggiBalance,
    maticBalance,
  ] = await Promise.all([
    reserveContract.liquidityManager().catch(() => "\u2014"),
    reserveContract.totalMaticReceived().catch(() => "0"),
    reserveContract.waitingBiggi().catch(() => "0"),
    reserveContract.dexRefillBiggi().catch(() => "0"),
    reserveContract.biggiBalance().catch(() => "0"),
    reserveContract.maticBalance().catch(() => "0"),
  ]);

  const payload = {
    reserveAddress,
    liquidityManager:
      liquidityManager !== ZERO_ADDRESS ? liquidityManager : "\u2014",
    totalMaticReceived: ethers.utils.formatEther(totalMaticReceived),
    waitingBiggi: ethers.utils.formatEther(waitingBiggi),
    dexRefillBiggi: ethers.utils.formatEther(dexRefillBiggi),
    biggiBalance: ethers.utils.formatEther(biggiBalance),
    maticBalance: ethers.utils.formatEther(maticBalance),
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
  let totalBiggiReceivedFromBuyback = "\u2014";
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
      totalBiggiReceivedFromBuyback = summary.totalBiggiReceivedFromBuyback;
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
        const erc20 = new ethers.Contract(tokenAddr, ERC20_MINI, provider);
        const bal = await erc20.balanceOf(treasuryAddr);
        tokenBalance = ethers.utils.formatEther(bal);
      }
    } catch {
      // ignore token balance fallback
    }

    try {
      const wei = await provider.getBalance(treasuryAddr);
      nativeBalance = ethers.utils.formatEther(wei);
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
    totalBiggiReceivedFromBuyback,
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

export async function refreshRewards({
  getReadOnlyLiquidityContract,
  setBiggiData,
  tokenIdsCsv = "",
}) {
  const brl = await getReadOnlyLiquidityContract();

  const [week, weights, unit, ids] = await Promise.all([
    brl.currentWeek().catch(() => null),
    brl.getBlockWeights().catch(() => null),
    Promise.resolve("1 BIGGI"),
    Promise.resolve(parseIdsCsv(tokenIdsCsv)),
  ]);

  let previewUnits = "\u2014";
  let previewAmount = "\u2014";
  try {
    if (ids.length) {
      const [u, a] = await brl.claimablePreview(ids);
      previewUnits = u.toString();
      previewAmount = `${ethers.utils.formatEther(a)} BIGGI`;
    }
  } catch {
    // ignore preview fetch
  }

  let stat = { tokenIds: [], claimableNow: [], weights: [], blockIdxs: [] };
  try {
    if (ids.length) {
      const [cNow, w, b] = await brl.claimStatus(ids);
      stat = {
        tokenIds: ids.map((x) => x.toString()),
        claimableNow: cNow,
        weights: w,
        blockIdxs: b,
      };
    }
  } catch {
    // ignore claim status fetch
  }

  setBiggiData((prev) => ({
    ...prev,
    rewards: {
      unitReward: unit,
      currentWeek: week != null ? Number(week) : "\u2014",
      blockWeights: Array.isArray(weights) ? Array.from(weights) : undefined,
      claimPreview: { units: previewUnits, amount: previewAmount },
      claimStatus: stat,
    },
  }));
}
