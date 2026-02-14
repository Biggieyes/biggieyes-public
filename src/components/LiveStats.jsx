// src/components/LiveStats.jsx
import * as React from "react";
import {
  BrowserProvider,
  Contract,
  ZeroAddress,
  formatEther,
  formatUnits,
} from "ethers";
import { BiggiLpPriceFeed } from "@/config/abi/index.js";
import {
  getTokenREWARDSRO,
  getDistributorRO,
  getROProvider,
  getPairRO,
  getReadOnlyLiquidityContract,
  getTokenRO,
  ADDR,
} from "@/shared/utils/contract";
import { fetchDistributorSnapshot } from "@/shared/services/tokenomics/distributor.reader";
import { DEFAULT_BLOCKS, BASE_PRICES } from "@/shared/blocks";
import ModalPortal from "./common/ModalPortal";
import WeeklyCountdown from "./WeeklyCountdown";
import useWeeklyCountdown from "../hooks/useWeeklyCountdown";
import "./LiveStatsPools.css";

const OKLINK_BASE = "https://www.oklink.com/amoy/address/";

const BlocksWidget = React.lazy(() => import("./BlocksWidget"));
const BackgroundsWidget = React.lazy(() => import("./BackgroundsWidget"));
const LiveChatPanel = React.lazy(() => import("./LiveChatPanel"));

// ---- minimal ABI for write ops ----
const TOKEN_REWARDS_MIN_ABI = [
  "function claim(uint256[] tokenIds) external",
  "function getBlockWeights() view returns(uint8[11])",
  "function unitReward() view returns(uint256)",
  "function tokenMeta() view returns(string name_,string symbol_,uint8 decimals_)",
];

const BACKGROUND_BONUSES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

// ===== ethers v5/v6 safe helpers =====
const isBigNumber = (value) =>
  Boolean(value && typeof value === "object" && value._isBigNumber);

const toBigNumberish = (value) => {
  if (value == null) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string") return value;
  if (isBigNumber(value)) return value.toString();
  if (typeof value?.toString === "function") return value.toString();
  return 0n;
};

const _formatUnits = (val, dec) => {
  try {
    return formatUnits(toBigNumberish(val), dec);
  } catch {
    return "0";
  }
};
const _formatEther = (val) => {
  try {
    return formatEther(val);
  } catch {
    try {
      return formatEther(toBigNumberish(val));
    } catch {
      if (typeof val === "bigint") return (Number(val) / 1e18).toString();
      return "0";
    }
  }
};
const _bn = (v) => {
  try {
    return BigInt(v);
  } catch {
    try {
      return BigInt(v);
    } catch {
      return 0n;
    }
  }
};
const _mul = (a, b) => _bn(a) * _bn(b);

function LiveStats({
  lastImage,
  lastNftId,
  lastBlockName,
  lastBackgroundName,
  biggiMinted,
  maxSupply,
  ticketMinted,
  maxTickets,
  ticketPrice,
  blockMintCounts,
  blockNames,
  blockPrices,
  backgroundMintCounts,
  rewardPool,
  myClaimable,
  items = [],
  walletAddress = "",
  blocksMinted,
  currentBlockPrices,
  bgsMinted,
  mintVolumeMatic = null,
  sharePercent = 22,
  epochStart = null,
  userLastClaimTs = null,
  weekSeconds = 7 * 24 * 60 * 60,
  fetchChainNowTs = null,
  lastFinalPrice = null,
  // lpPrice,
  // setLpPrice,
}) {
  // LP price state
  const [lpPrice, setLpPrice] = React.useState(null);
  // Fetch LP price from on-chain feed
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const prov = getROProvider();
        const feedAddr = ADDR.LP_PRICE_FEED;
        if (feedAddr) {
          const feed = new Contract(feedAddr, BiggiLpPriceFeed, prov);
          const round = await feed.latestRoundData().catch(() => null);
          const dec = await feed.decimals().catch(() => 18);
          if (!alive) return;
          if (round && round.answer != null) {
            const price = Number(_formatUnits(round.answer, dec));
            if (Number.isFinite(price)) setLpPrice(price);
          }
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Zobrazen� LP ceny v UI (p��klad, uprav dle skute�n�ho layoutu):
  // <div>LP token price: {lpPrice != null ? lpPrice + ' POL' : '--'}</div>
  const [showBlocks, setShowBlocks] = React.useState(false);
  const [showBgStats, setShowBgStats] = React.useState(false);
  const [showREWARDS, setShowREWARDS] = React.useState(false);
  const [weeklyOpen, setWeeklyOpen] = React.useState(false);
  const weeklyBtnRef = React.useRef(null);

  const [poolsOpen, setPoolsOpen] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [pools, setPools] = React.useState(null);
  const weekDuration = weekSeconds || 7 * 24 * 60 * 60;
  const {
    displayed: weeklyDisplayed,
    loading: weeklyLoading,
    error: weeklyError,
    isClaiming: weeklyIsClaiming,
    claimSuccess: weeklyClaimSuccess,
    syncWeeklyInfo,
    handleClaim: weeklyHandleClaim,
  } = useWeeklyCountdown({
    epochStart,
    fetchChainNowTs,
    weekSeconds,
  });

  const [isPhone, setIsPhone] = React.useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 700px)").matches
      : false,
  );
  const [isTiny, setIsTiny] = React.useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 480px)").matches
      : false,
  );
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq700 = window.matchMedia("(max-width: 700px)");
    const mq480 = window.matchMedia("(max-width: 480px)");
    const on700 = (e) => setIsPhone(e.matches);
    const on480 = (e) => setIsTiny(e.matches);

    try {
      mq700.addEventListener("change", on700);
      mq480.addEventListener("change", on480);
    } catch {
      mq700.addListener(on700);
      mq480.addListener(on480);
    }
    setIsPhone(mq700.matches);
    setIsTiny(mq480.matches);
    return () => {
      try {
        mq700.removeEventListener("change", on700);
        mq480.removeEventListener("change", on480);
      } catch {
        mq700.removeListener(on700);
        mq480.removeListener(on480);
      }
    };
  }, []);

  // Additional on-chain-derived state (contract-focused changes only)
  const [poolFromContract, setPoolFromContract] = React.useState(null);
  const [weightsFromContract, setWeightsFromContract] = React.useState(null);
  const [unitRewardWei, setUnitRewardWei] = React.useState(null);
  const [tokenSymbol, setTokenSymbol] = React.useState("BIGGI");
  const [tokenDecimals, setTokenDecimals] = React.useState(18);

  // new: read some potentially useful derived chain values if available
  const [lastFinalFromChain, setLastFinalFromChain] = React.useState(null);
  const [blockPricesFromChain, setBlockPricesFromChain] = React.useState(null);

  const effectiveBlockPrices = React.useMemo(() => {
    const normalize = (arr) =>
      Array.isArray(arr)
        ? arr.map((v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          })
        : [];
    const hasAnyValue = (arr) =>
      Array.isArray(arr) &&
      arr.some((v) => Number.isFinite(Number(v)));

    // Prefer prices coming from MAIN/snapshot props.
    // Liquidity-derived array is only a last-resort fallback.
    if (hasAnyValue(currentBlockPrices)) return normalize(currentBlockPrices);
    if (hasAnyValue(blockPrices)) return normalize(blockPrices);
    if (hasAnyValue(blockPricesFromChain)) return normalize(blockPricesFromChain);
    return [];
  }, [blockPricesFromChain, currentBlockPrices, blockPrices]);

  const effectiveBlockMintCounts = blocksMinted ?? blockMintCounts ?? [];
  const effectiveBackgroundMintCounts = bgsMinted ?? backgroundMintCounts ?? [];
  const safeBlockNames = Array.isArray(blockNames) ? blockNames : [];

  const onlyTickets = React.useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    return arr.length > 0 && arr.every((it) => it?.isTicket);
  }, [items]);

  const resetAll = React.useCallback(() => {
    setShowBlocks(false);
    setShowBgStats(false);
    setShowREWARDS(false);
  }, []);

  const openBlocks = React.useCallback(() => {
    resetAll();
    setShowBlocks(true);
  }, [resetAll]);

  const openBackgrounds = React.useCallback(() => {
    resetAll();
    setShowBgStats(true);
  }, [resetAll]);

  const openREWARDS = React.useCallback(() => {
    resetAll();
    setShowREWARDS(true);
  }, [resetAll]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleEscapeBack = (event) => {
      if (event.key !== "Escape") return;
      let handled = false;
      if (showBlocks || showBgStats || showREWARDS) {
        resetAll();
        handled = true;
      } else if (weeklyOpen) {
        setWeeklyOpen(false);
        handled = true;
      } else if (poolsOpen) {
        setPoolsOpen(false);
        handled = true;
      } else if (chatOpen) {
        setChatOpen(false);
        handled = true;
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleEscapeBack);
    return () => window.removeEventListener("keydown", handleEscapeBack);
  }, [
    showBlocks,
    showBgStats,
    showREWARDS,
    weeklyOpen,
    poolsOpen,
    chatOpen,
    resetAll,
  ]);

  const weeklyCountdownInfo = React.useMemo(
    () => ({
      ...weeklyDisplayed,
      loading: weeklyLoading,
      error: weeklyError,
    }),
    [weeklyDisplayed, weeklyLoading, weeklyError],
  );

  const computedREWARDSPool = React.useMemo(() => {
    if (typeof rewardPool === "number" && !Number.isNaN(rewardPool))
      return rewardPool;
    if (typeof poolFromContract === "number" && !Number.isNaN(poolFromContract))
      return poolFromContract;
    if (
      typeof mintVolumeMatic === "number" &&
      !Number.isNaN(mintVolumeMatic) &&
      typeof sharePercent === "number" &&
      !Number.isNaN(sharePercent)
    ) {
      return mintVolumeMatic * (sharePercent / 100);
    }
    return null;
  }, [mintVolumeMatic, sharePercent, rewardPool, poolFromContract]);

  // Read token REWARDS metadata (weights, unitReward, token meta) — robust, contract-only changes
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let r = null;
        try {
          r = getTokenREWARDSRO();
        } catch {
          r = null;
        }
        if (!r) return;

        const calls = [];
        calls.push(
          typeof r.getBlockWeights === "function"
            ? r.getBlockWeights()
            : Promise.resolve(null),
        );
        calls.push(
          typeof r.unitReward === "function"
            ? r.unitReward()
            : Promise.resolve(null),
        );
        calls.push(
          typeof r.tokenMeta === "function"
            ? r.tokenMeta()
            : Promise.resolve(null),
        );

        const [wArr, unitWei, meta] = await Promise.all(calls);
        if (!alive) return;

        if (wArr && Array.isArray(wArr)) {
          const w = Array.from(wArr)
            .slice(1)
            .map((n) => Number(n || 0));
          setWeightsFromContract(w.length === 10 ? w : null);
        }

        if (unitWei != null) setUnitRewardWei(unitWei);
        const sym = meta?.symbol_ ?? meta?.[1] ?? null;
        const dec = meta?.decimals_ ?? meta?.[2] ?? null;
        if (sym && typeof sym === "string") setTokenSymbol(sym);
        if (Number.isFinite(Number(dec))) setTokenDecimals(Number(dec));
      } catch (e) {
        // silent fallback — not critical
        console.warn("LiveStats: failed reading token REWARDS metadata", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const WEIGHTS = React.useMemo(() => {
    if (
      Array.isArray(weightsFromContract) &&
      weightsFromContract.length === 10
    ) {
      return weightsFromContract;
    }
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  }, [weightsFromContract]);

  // Try to fetch a weekly REWARDS pool from the liquidity/readers (contract-focused)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const liq = (() => {
          try {
            return getReadOnlyLiquidityContract();
          } catch {
            return null;
          }
        })();
        if (!liq) return;

        const candidates = [
          "weeklyPool",
          "currentWeekPool",
          "getWeeklyPool",
          "weekPool",
          "poolForCurrentWeek",
          "rewardPool",
          "currentRewardPool",
          // reader fallback names
        ];
        for (const fn of candidates) {
          const f = liq?.[fn];
          if (typeof f === "function") {
            try {
              const wei = await f();
              const n = Number(_formatEther(wei));
              if (!cancelled && Number.isFinite(n)) {
                setPoolFromContract(n);
                break;
              }
            } catch {
              // try next
            }
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // New: attempt to read last final price from on-chain reader/liquidity contract
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const liq = (() => {
          try {
            return getReadOnlyLiquidityContract();
          } catch {
            return null;
          }
        })();
        if (!liq) return;

        const candidates = [
          "lastFinalPrice",
          "finalPrice",
          "getFinalPrice",
          "lastPrice",
          "finalPriceWei",
          "getFinalPriceWei",
        ];
        for (const fn of candidates) {
          const f = liq?.[fn];
          if (typeof f === "function") {
            try {
              const val = await f();
              if (val != null) {
                // normalize large-weis to numeric POL-ish
                let num = null;
                try {
                  num = Number(_formatEther(val));
                } catch {
                  const s = String(val ?? "");
                  const parsed = Number(s);
                  if (Number.isFinite(parsed)) num = parsed;
                }
                if (!cancelled && Number.isFinite(num) && num > 0) {
                  setLastFinalFromChain(num);
                  break;
                }
              }
            } catch {
              // try next
            }
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // New: attempt to read block price array from on-chain reader/liquidity contract
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const liq = (() => {
          try {
            return getReadOnlyLiquidityContract();
          } catch {
            return null;
          }
        })();
        if (!liq) return;

        const candidates = [
          "getCurrentBlockPrices",
          "currentBlockPrices",
          "blockPrices",
          "getBlockPrices",
        ];
        for (const fn of candidates) {
          const f = liq?.[fn];
          if (typeof f === "function") {
            try {
              const res = await f();
              if (res && (Array.isArray(res) || typeof res === "object")) {
                // attempt to normalize into numeric array
                const arr = Array.isArray(res) ? res : Array.from(res);
                const nums = arr.map((v) => {
                  try {
                    return Number(_formatEther(v));
                  } catch {
                    const n = Number(v);
                    return Number.isFinite(n) ? n : null;
                  }
                });
                const anyValid = nums.some((n) => Number.isFinite(n));
                if (!cancelled && anyValid) {
                  setBlockPricesFromChain(
                    nums.map((n) => (Number.isFinite(n) ? n : null)),
                  );
                  break;
                }
              }
            } catch {
              // try next
            }
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pools refresh (defensive contract usage)
  const refreshPools = React.useCallback(async () => {
    try {
      const r = (() => {
        try {
          return getDistributorRO();
        } catch {
          return null;
        }
      })();
      const prov = (() => {
        try {
          return getROProvider();
        } catch {
          return null;
        }
      })();

      if (!r || !prov) throw new Error("Distributor or provider not available");

        const resolveCollectionRewards = async () => {
          if (typeof r.collectionRewards === "function")
            return r.collectionRewards();
          if (typeof r.COLLECTIONREWARDS === "function")
            return r.COLLECTIONREWARDS();
          return ADDR.COLLECTION_REWARDS || ZeroAddress;
        };
        const resolveCommunityCenter = async () => {
          if (typeof r.communityCenter === "function")
            return r.communityCenter();
          if (typeof r.COMMUNITYCENTER === "function")
            return r.COMMUNITYCENTER();
          return (
            ADDR.COMMUNITY_CENTER ||
            ADDR.COMMUNITYCENTER ||
            ZeroAddress
          );
        };

        const [
          totalReceived,
          receivedForMain,
          reserveAddr,
          collREWARDSAddr,
          BUYBACKAddr,
          treasuryAddr,
          COMMUNITYCENTERAddr,
        ] = await Promise.all([
          typeof r.totalReceived === "function"
            ? r.totalReceived()
            : Promise.resolve(0n),
          typeof r.receivedByAddress === "function"
            ? r.receivedByAddress(ADDR.MAIN)
            : typeof r.receivedByCOLLECTION === "function"
              ? r.receivedByCOLLECTION(ADDR.MAIN)
              : Promise.resolve(0n),
        typeof r.reserve === "function"
          ? r.reserve()
          : Promise.resolve(ADDR.RESERVE || ZeroAddress),
          resolveCollectionRewards(),
          typeof r.buybackAgent === "function"
            ? r.buybackAgent()
            : typeof r.BUYBACKAgent === "function"
              ? r.BUYBACKAgent()
              : Promise.resolve(ADDR.BUYBACK_AGENT || ZeroAddress),
          typeof r.treasury === "function"
            ? r.treasury()
            : Promise.resolve(ADDR.TREASURY || ZeroAddress),
          resolveCommunityCenter(),
        ]);

      const targets = [
        { key: "reserve", name: "Reserve", addr: reserveAddr },
        { key: "BUYBACK", name: "Buyback Agent", addr: BUYBACKAddr },
        { key: "treasury", name: "Treasury", addr: treasuryAddr },
        { key: "community", name: "Community Center", addr: COMMUNITYCENTERAddr },
        { key: "REWARDS", name: "Collection Rewards", addr: collREWARDSAddr },
      ];

      let allocations = {};
      try {
        const distSnapshot = await fetchDistributorSnapshot({
          provider: prov,
        }).catch(() => null);
        if (distSnapshot) {
          allocations = {
            reserve: distSnapshot.pendingReserve ?? null,
            BUYBACK: distSnapshot.pendingBUYBACK ?? null,
            treasury: distSnapshot.pendingTreasury ?? null,
            community:
              distSnapshot.pendingCOMMUNITYCENTER ??
              distSnapshot.pendingCommunity ??
              null,
            REWARDS: distSnapshot.pendingCOLLECTIONREWARDS ?? null,
          };
        }
      } catch {
        allocations = {};
      }

        const communityNativeBalance = COMMUNITYCENTERAddr
          ? await prov.getBalance(COMMUNITYCENTERAddr).catch(() => 0n)
          : 0n;

      const balancesArr = await Promise.all(
        targets.map((t) => {
            if (t.key === "community") return Promise.resolve(communityNativeBalance);
            return prov.getBalance(t.addr).catch(() => 0n);
          }),
        );

      const balances = {};
      targets.forEach((t, i) => {
        balances[t.key] = balancesArr[i];
      });

      const distBal = await prov
        .getBalance(ADDR.DISTRIBUTOR)
        .catch(() => 0n);

      setPools({
        distributor: ADDR.DISTRIBUTOR,
        distributorBal: distBal,
        totalReceived,
        receivedForMain,
        targets,
        allocations,
        balances,
      });
    } catch (e) {
      console.error("refreshPools error", e);
      setPools(null);
    }
  }, []);

  // BIGGI ECOSYSTEM METRICS (unchanged intent, contract reads robustified)
  const [biggiPrice, setBiggiPrice] = React.useState(null);
  const [priceQuoteSymbol, setPriceQuoteSymbol] = React.useState("POL");
  const [biggiChange24h, setBiggiChange24h] = React.useState(null);
  const [biggiSupply, setBiggiSupply] = React.useState(null);
  const [circulatingSupply, setCirculatingSupply] = React.useState(null);
  const biggiMcap = React.useMemo(() => {
    const supplyForMarketCap =
      typeof circulatingSupply === "number" ? circulatingSupply : biggiSupply;
    if (
      typeof biggiPrice === "number" &&
      typeof supplyForMarketCap === "number"
    ) {
      return biggiPrice * supplyForMarketCap;
    }
    return null;
  }, [biggiPrice, biggiSupply, circulatingSupply]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const prov = (() => {
          try {
            return getROProvider();
          } catch {
            return null;
          }
        })();
        if (!prov) return;

        const tokenAddr =
          (ADDR && (ADDR.BIGGI || ADDR.TOKEN || ADDR.BIGGI_TOKEN)) || null;

        if (tokenAddr) {
          const erc20Abi = [
            "function totalSupply() view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)",
          ];
          const token = new Contract(tokenAddr, erc20Abi, prov);

          const [supBn, dec, sym] = await Promise.all([
            token.totalSupply().catch(() => null),
            token.decimals().catch(() => null),
            token.symbol().catch(() => null),
          ]);

          if (!alive) return;

          if (sym && typeof sym === "string") {
            setTokenSymbol(sym);
          }
          if (Number.isFinite(Number(dec))) {
            setTokenDecimals(Number(dec));
          }
          if (supBn && Number.isFinite(Number(dec))) {
            const sup = Number(_formatUnits(supBn, Number(dec)));
            if (Number.isFinite(sup)) setBiggiSupply(sup);
          }
        }

        const priceOracleAddr =
          (ADDR && (ADDR.BIGGI_PRICE_ORACLE || ADDR.PRICE_ORACLE)) || null;

        if (priceOracleAddr) {
          const oracleAbi = [
            "function latestRoundData() view returns (uint80 roundId,int256 answer,uint256 startedAt,uint256 updatedAt,uint80 answeredInRound)",
            "function decimals() view returns (uint8)",
          ];
          const oracle = new Contract(priceOracleAddr, oracleAbi, prov);
          const [round, dec] = await Promise.all([
            oracle.latestRoundData().catch(() => null),
            oracle.decimals().catch(() => 8),
          ]);
          if (!alive) return;
          if (round && round.answer != null) {
            const p = Number(_formatUnits(round.answer, Number(dec)));
            if (Number.isFinite(p)) setBiggiPrice(p);
          }
          // setBiggiChange24h(xxx);
        }
      } catch (e) {
        console.warn("LiveStats: failed reading token metrics", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    let alive = true;
    if (
      biggiSupply == null ||
      typeof biggiSupply !== "number" ||
      biggiSupply === 0
    ) {
      setCirculatingSupply(null);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const provider = (() => {
          try {
            return getROProvider();
          } catch {
            return null;
          }
        })();
        if (!provider) return;

        const token = (() => {
          try {
            return getTokenRO(provider);
          } catch {
            return null;
          }
        })();
        if (!token || typeof token.balanceOf !== "function") return;

        const lockedAddrs = [
          ADDR.RESERVE,
          ADDR.TOKEN_REWARDS,
          ADDR.DRIP_DISTRIBUTOR,
        ].filter(Boolean);
        if (!lockedAddrs.length) return;

        const decimalsForLocked = Number.isFinite(Number(tokenDecimals))
          ? Number(tokenDecimals)
          : 18;

        const balances = await Promise.all(
          lockedAddrs.map((addr) =>
            token.balanceOf(addr).catch(() => 0n),
          ),
        );
        if (!alive) return;

        const locked = balances.reduce((sum, bn) => {
          const n = Number(
            _formatUnits(bn ?? 0n, decimalsForLocked),
          );
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
        if (!Number.isFinite(locked)) return;

        const circulating = Math.max(0, biggiSupply - locked);
        if (!alive) return;
        setCirculatingSupply(circulating);
      } catch (err) {
        console.warn("LiveStats: failed to compute circulating supply", err);
      }
    })();

    return () => {
      alive = false;
    };
  }, [biggiSupply, tokenDecimals]);

  // DEX price fallback (robust contract usage) - computes price against any quote token, respects decimals, updates quote symbol
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (!ADDR?.PAIR) return;
        const pair = (() => {
          try {
            return getPairRO();
          } catch {
            return null;
          }
        })();
        if (!pair || typeof pair.getReserves !== "function") return;

        const [r0, r1] = await pair.getReserves();
        const [t0, t1] = await Promise.all([pair.token0(), pair.token1()]);

        const biggiAddr = (ADDR.BIGGI || ADDR.BIGGI_TOKEN || "").toLowerCase();
        const addr0 = String(t0 || "").toLowerCase();
        const addr1 = String(t1 || "").toLowerCase();
        if (!biggiAddr || !addr0 || !addr1) return;

        const erc20Meta = async (addr) => {
          try {
            const abi = [
              "function decimals() view returns (uint8)",
              "function symbol() view returns (string)",
            ];
            const erc = new Contract(addr, abi, getROProvider());
            const [dec, sym] = await Promise.all([
              erc.decimals().catch(() => 18),
              erc.symbol().catch(() => ""),
            ]);
            return {
              decimals: Number(dec) || 18,
              symbol: typeof sym === "string" && sym.length ? sym : "",
            };
          } catch {
            return { decimals: 18, symbol: "" };
          }
        };

        const [m0, m1] = await Promise.all([erc20Meta(t0), erc20Meta(t1)]);
        if (cancel) return;

        const normalizeQuoteSymbol = (sym) => {
          const s = String(sym || "").toUpperCase();
          if (!s) return "POL";
          if (["WETH", "WMATIC", "WPOL", "W-POL"].includes(s)) return "POL";
          return sym;
        };

        let price = null;
        if (addr0 === biggiAddr) {
          const base = Number(_formatUnits(r0, m0.decimals));
          const quote = Number(_formatUnits(r1, m1.decimals));
          if (
            Number.isFinite(base) &&
            base > 0 &&
            Number.isFinite(quote) &&
            quote > 0
          ) {
            price = quote / base;
            if (m1.symbol) setPriceQuoteSymbol(normalizeQuoteSymbol(m1.symbol));
          }
        } else if (addr1 === biggiAddr) {
          const base = Number(_formatUnits(r1, m1.decimals));
          const quote = Number(_formatUnits(r0, m0.decimals));
          if (
            Number.isFinite(base) &&
            base > 0 &&
            Number.isFinite(quote) &&
            quote > 0
          ) {
            price = quote / base;
            if (m0.symbol) setPriceQuoteSymbol(normalizeQuoteSymbol(m0.symbol));
          }
        }

        if (!cancel && Number.isFinite(price) && price > 0) {
          setBiggiPrice(price);
        }
      } catch (e) {
        console.warn("LiveStats: failed reading DEX price", e);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // Layout
  const BOX = isPhone ? (isTiny ? 110 : 130) : 150;
  const PADDING = isPhone
    ? isTiny
      ? "14px 12px 12px 12px"
      : "24px 16px 18px 16px"
    : "38px 44px 32px 44px";
  const boxFontSize = isTiny ? "0.75em" : isPhone ? "0.85em" : "0.95em";
  const boxBigFontSize = isTiny ? "1.0em" : isPhone ? "1.15em" : "1.3em";
  const infoCardFontSize = isTiny ? "0.7em" : isPhone ? "0.8em" : "0.9em";
  const infoCardBigFontSize = isTiny ? "0.95em" : isPhone ? "1.05em" : "1.2em";
  const mobileMaxWidth = isPhone ? (isTiny ? 320 : 420) : undefined;
  const statsBoxWidth = isPhone ? (isTiny ? "100%" : "calc(50% - 6px)") : BOX;
  const statsBoxHeight = isPhone ? "auto" : BOX;
  const statsBoxMinHeight = isPhone ? (isTiny ? 96 : 110) : BOX;
  const infoBoxWidth = isPhone ? "100%" : BOX;
  const infoBoxHeight = isPhone ? "auto" : BOX;
  const infoBoxMinHeight = isPhone ? (isTiny ? 110 : 120) : BOX;
  const imageBox = isPhone ? (isTiny ? 150 : 170) : BOX;
  const statsGroupDirection = isPhone ? (isTiny ? "column" : "row") : "column";
  const statsGroupWidth = isPhone ? "100%" : statsBoxWidth;

  const widgetStyle = {
    minWidth: isPhone ? "auto" : 700,
    width: isPhone ? "94vw" : undefined,
    maxWidth: isPhone ? "94vw" : 800,
    minHeight: isPhone ? (isTiny ? 280 : 320) : 320,
    padding: PADDING,
    display: "flex",
    flexDirection: "column",
    alignItems: isPhone ? "stretch" : "center",
    justifyContent: "flex-start",
    border: "3px solid #ffe800",
    borderRadius: isPhone ? 16 : 23,
    boxShadow: "0 12px 60px rgba(0,0,0,0.7), 0 0 18px #ffe800",
    position: "relative",
    zIndex: 20,
    transform: isPhone ? "none" : "translate(254px, -92px)",
    overflow: "hidden",
    backgroundImage: 'url("/images/blocks-bg.png")',
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backdropFilter: isPhone ? "blur(4px)" : "blur(8px)",
  };

  const statsMainFlex = {
    width: "100%",
    display: "flex",
    flexDirection: isPhone ? "column" : "row",
    justifyContent: "center",
    alignItems: isPhone ? "stretch" : "flex-start",
    gap: isPhone ? (isTiny ? "10px" : "14px") : "36px",
    marginTop: isPhone ? "8px" : "20px",
  };

  const columnCenter = {
    display: "flex",
    flexDirection: "column",
    alignItems: isPhone ? "stretch" : "center",
    justifyContent: "center",
    gap: isPhone ? "12px" : "8px",
    marginTop: "0",
    width: isPhone ? "100%" : statsGroupWidth,
    maxWidth: mobileMaxWidth,
  };

  const statsTable = {
    width: statsBoxWidth,
    height: statsBoxHeight,
    minHeight: statsBoxMinHeight,
    fontSize: boxFontSize,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    margin: isPhone ? 0 : "0 auto",
    gap: isPhone ? 4 : 6,
    backgroundImage: 'url("/images/blocks-bg.png")',
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    padding: isPhone ? "10px 12px" : "14px 18px",
    borderRadius: 16,
    boxShadow: "0 6px 20px rgba(0,0,0,0.6), 0 0 12px #ffe800",
    border: "1px solid rgba(255, 232, 0, 0.5)",
    transition: "all 0.3s ease",
    boxSizing: "border-box",
  };

  const ticketPriceTable = {
    ...statsTable,
    marginTop: isPhone ? (isTiny ? "6px" : "8px") : "12px",
    height: statsBoxHeight,
    padding: isPhone ? "10px 12px" : "14px 18px",
  };

  const statsGroupStyle = {
    display: "flex",
    flexDirection: statsGroupDirection,
    gap: isPhone ? "10px" : "8px",
    marginTop: "0",
    width: statsGroupWidth,
    alignItems: "stretch",
    justifyContent: isPhone && !isTiny ? "space-between" : "center",
    flexWrap: isPhone && !isTiny ? "wrap" : "nowrap",
  };

  const titleStyle = { color: "#fff", fontWeight: 700, fontSize: boxFontSize };

  const thBase = {
    position: "sticky",
    top: 0,
    zIndex: 1,
    background:
      "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.85) 100%)",
    backdropFilter: "blur(3px)",
    color: "#ffe800",
    textAlign: "center",
    fontWeight: 900,
    textTransform: "uppercase",
    fontSize: "0.88em",
    padding: isPhone ? "8px 6px" : "10px 8px",
    borderBottom: "1px solid rgba(255,232,0,0.25)",
    letterSpacing: "0.3px",
  };

  const tdBase = {
    padding: isPhone ? "8px 6px" : "10px 8px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: isPhone ? "0.95em" : undefined,
  };

  const poolsTableStyle = React.useMemo(
    () => ({
      width: "100%",
      borderCollapse: "collapse",
      tableLayout: "fixed",
    }),
    [],
  );

  // ====== CLAIM integration ======
  const [claimBusy, setClaimBusy] = React.useState(false);
  const [claimMsg, setClaimMsg] = React.useState("");

  const collectTokenIds = () => {
    const out = [];
    for (const it of Array.isArray(items) ? items : []) {
      const raw = it?.tokenId ?? it?.id;
      if (raw == null) continue;
      const s = String(raw);
      const n = Number(s);
      if (Number.isFinite(n) && n > 0) out.push(s); // pass as string; ethers handles
    }
    return out;
  };

  const canClaim = React.useMemo(() => collectTokenIds().length > 0, [items]);

  const handleClaim = async () => {
    if (claimBusy) return;
    if (!canClaim) {
      alert("No token IDs to claim for.");
      return;
    }
    const eth = typeof window !== "undefined" ? window.ethereum : null;
    if (!eth?.request) {
      alert("Injected wallet not detected.");
      return;
    }

    setClaimBusy(true);
    setClaimMsg("Preparing transaction…");
    try {
      // ensure account
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts || !accounts.length) throw new Error("No accounts");

      const provider = new BrowserProvider(eth, "any");
      const signer = await provider.getSigner();

      const REWARDSAddr =
        ADDR?.TOKEN_REWARDS ||
        ADDR?.BIGGI_TOKEN_REWARDS ||
        ADDR?.REWARDS ||
        null;
      if (!REWARDSAddr) throw new Error("REWARDS contract address missing");

      const REWARDS = new Contract(
        REWARDSAddr,
        TOKEN_REWARDS_MIN_ABI,
        signer,
      );
      const tokenIds = collectTokenIds();

      // gas estimate
      let gas;
        try {
          const estimateClaim =
            REWARDS.estimateGas?.claim || REWARDS.claim?.estimateGas;
          const est = estimateClaim ? await estimateClaim(tokenIds) : null;
          if (est != null) {
            if (isBigNumber(est) && typeof est.mul === "function") {
              gas = est.mul(110).div(100);
          } else if (typeof est === "bigint") {
            gas = (est * 110n) / 100n;
          } else {
            gas = est;
          }
        } else {
          gas = undefined;
        }
      } catch {
        gas = undefined;
      }

      setClaimMsg("Sending transaction…");
      const tx = await REWARDS.claim(tokenIds, gas ? { gasLimit: gas } : {});
      setClaimMsg(`Pending: ${tx.hash || ""}`);

      const receipt = await (tx.wait
        ? tx.wait()
        : provider.waitForTransaction(tx.hash));
      if (receipt?.status === 0) throw new Error("Transaction failed");

      setClaimMsg("Claim successful");
      alert("Claim successful.");
    } catch (err) {
      console.error("Claim failed", err);
      const msg = String(
        err?.reason || err?.data?.message || err?.message || err,
      );
      setClaimMsg(`Failed: ${msg}`);
      alert(`Claim failed: ${msg}`);
    } finally {
      setClaimBusy(false);
      setTimeout(() => setClaimMsg(""), 4000);
    }
  };

  const actionBtnBase = React.useMemo(
    () => ({
      fontWeight: "bold",
      padding: isPhone ? "10px 16px" : "10px 18px",
      borderRadius: 10,
      cursor: "pointer",
      minWidth: 180,
    }),
    [isPhone],
  );

  const menuBtnBase = React.useMemo(
    () => ({
      ...actionBtnBase,
    }),
    [actionBtnBase],
  );

  const modalOverlayStyle = React.useMemo(
    () => ({
      position: "fixed",
      inset: 0,
      zIndex: 999,
      width: "100vw",
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      pointerEvents: "auto",
      padding: 0,
      overFLOW: "hidden",
      backgroundColor: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(6px)",
    }),
    [],
  );

  const fullscreenModalFrameStyle = React.useMemo(
    () => ({
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: 0,
    }),
    [],
  );

  const fullscreenModalCardStyle = React.useMemo(() => {
    const padding = isPhone ? 12 : 28;
    return {
      width: "100vw",
      height: "100vh",
      maxWidth: "100vw",
      maxHeight: "100vh",
      overFLOWY: "auto",
      borderRadius: 0,
      border: "2px solid #ffe800",
      boxShadow: "none",
      backgroundImage:
        'linear-gradient(180deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.45) 100%), url("/images/widget-bg-dark.png")',
      backgroundSize: "cover, cover",
      backgroundPosition: "center, center",
      backgroundRepeat: "no-repeat, no-repeat",
      padding,
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
    };
  }, [isPhone]);

  const modalHeaderStyle = React.useMemo(
    () => ({
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: isPhone ? "6px 6px" : "6px 8px",
      borderBottom: "1px solid rgba(255,232,0,0.25)",
      position: "sticky",
      top: 0,
      background: "rgba(6,6,6,0.9)",
      backdropFilter: "blur(6px)",
      zIndex: 5,
    }),
    [isPhone],
  );

  const handleToggleWeekly = React.useCallback(() => {
    setWeeklyOpen((v) => !v);
  }, []);

  const handlePoolsButtonClick = React.useCallback(async () => {
    const next = !poolsOpen;
    setPoolsOpen(next);
    if (next) await refreshPools();
  }, [poolsOpen, refreshPools]);

  const handleChatButtonClick = React.useCallback(() => {
    setChatOpen((v) => !v);
  }, []);

  React.useEffect(() => {
    if (!weeklyOpen) return;
    syncWeeklyInfo();
  }, [weeklyOpen, syncWeeklyInfo]);

  const menuButtons = React.useMemo(
    () => [
      { label: "BLOCKS", active: showBlocks, onClick: openBlocks },
      { label: "BACKGROUNDS", active: showBgStats, onClick: openBackgrounds },
      { label: "COLLECTION STATS", active: showREWARDS, onClick: openREWARDS },
    ],
    [
      showBlocks,
      openBlocks,
      showBgStats,
      openBackgrounds,
      showREWARDS,
      openREWARDS,
    ],
  );

  const topButtonsRow = (
    <div
      className="live-stats-buttons-row"
      style={{
        display: "flex",
        justifyContent: isPhone ? "space-between" : "center",
        alignItems: "center",
        gap: isPhone ? "6px" : "12px",
        marginBottom: isPhone ? "8px" : "10px",
        marginTop: isPhone ? "22px" : "30px",
        flexWrap: isPhone ? "wrap" : "nowrap",
        width: "100%",
      }}
    >
      {menuButtons.map((btn) => (
        <button
          key={btn.label}
          onClick={btn.onClick}
          style={{
            ...menuBtnBase,
            background: "#000",
            color: "#ffe800",
            border: "2px solid #08ffe6",
            boxShadow: "0 0 14px rgba(255,232,0,0.25)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            willChange: "transform",
            ...(isPhone
              ? { flex: "1 1 0%", minWidth: 0, textAlign: "center" }
              : { minWidth: 180 }),
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.transform = "translateY(-2px)";
            event.currentTarget.style.boxShadow =
              "0 0 20px rgba(255,232,0,0.4)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform = "none";
            event.currentTarget.style.boxShadow =
              "0 0 14px rgba(255,232,0,0.25)";
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );

  // computed final price: prefer on-chain lastFinalFromChain, then prop lastFinalPrice, then fallback to block price
  const computedFinalPrice = React.useMemo(() => {
    if (typeof lastFinalFromChain === "number" && lastFinalFromChain > 0) {
      return Math.round(lastFinalFromChain);
    }

    const normalize = (val) => {
      if (val == null) return null;
      let n;
      if (typeof val === "object") {
        if (typeof val.toString === "function") {
          const s = val.toString();
          n = Number(s);
        }
      } else if (
        typeof val === "string" ||
        typeof val === "number" ||
        typeof val === "bigint"
      ) {
        n = Number(val);
      }
      if (!Number.isFinite(n)) return null;
      if (n > 1e12) n = n / 1e18;
      return n;
    };

    const fromProp = normalize(lastFinalPrice);
    if (typeof fromProp === "number" && fromProp > 0) {
      return Math.round(fromProp);
    }

    const idx =
      Array.isArray(safeBlockNames) && lastBlockName
        ? safeBlockNames.indexOf(String(lastBlockName).toUpperCase())
        : -1;
    const base =
      idx >= 0 && Number.isFinite(Number(effectiveBlockPrices?.[idx]))
        ? Math.round(Number(effectiveBlockPrices[idx]))
        : null;

    return base;
  }, [
    lastFinalFromChain,
    lastFinalPrice,
    safeBlockNames,
    lastBlockName,
    effectiveBlockPrices,
  ]);

  const formatMaybe = React.useCallback((value, digits = 2) => {
    if (value == null || !Number.isFinite(Number(value))) return "--";
    const n = Number(value);
    return n.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }, []);

  const formatSigned = React.useCallback((value, digits = 2) => {
    if (value == null || !Number.isFinite(Number(value))) return "--";
    const n = Number(value);
    const sign = n > 0 ? "+" : n < 0 ? "-" : "";
    const abs = Math.abs(n);
    return (
      sign +
      abs.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    );
  }, []);

  const collectionBlockNames = React.useMemo(() => {
    const names = Array.isArray(safeBlockNames) ? safeBlockNames : [];
    return names.length ? names : DEFAULT_BLOCKS;
  }, [safeBlockNames]);

  const blockPriceStats = React.useMemo(() => {
    const values = (effectiveBlockPrices || [])
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));
    if (!values.length) return { avg: null, min: null, max: null };
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { avg, min, max };
  }, [effectiveBlockPrices]);

  const totalBackgroundMinted = React.useMemo(
    () =>
      (effectiveBackgroundMintCounts || []).reduce(
        (acc, v) => acc + (Number(v) || 0),
        0,
      ),
    [effectiveBackgroundMintCounts],
  );

  const totalBlockMinted = React.useMemo(
    () =>
      (effectiveBlockMintCounts || []).reduce(
        (acc, v) => acc + (Number(v) || 0),
        0,
      ),
    [effectiveBlockMintCounts],
  );

  const ownedNftCount = React.useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    return arr.filter((it) => it && !it.isTicket && !it.isPending).length;
  }, [items]);

  const collectionBlockRows = React.useMemo(() => {
    return collectionBlockNames.map((name, idx) => {
      const live = Number(effectiveBlockPrices?.[idx]);
      const base = Number(BASE_PRICES?.[name] ?? idx + 1);
      const minted = Number(effectiveBlockMintCounts?.[idx] ?? 0);
      const liveValue = Number.isFinite(live) ? live : base;
      const delta = Number.isFinite(liveValue) ? liveValue - base : 0;
      return {
        name,
        minted,
        base,
        live: Number.isFinite(live) ? live : null,
        delta,
      };
    });
  }, [
    collectionBlockNames,
    effectiveBlockPrices,
    effectiveBlockMintCounts,
  ]);

  const collectionBackgroundRows = React.useMemo(() => {
    return collectionBlockNames.map((name, idx) => {
      const minted = Number(effectiveBackgroundMintCounts?.[idx] ?? 0);
      const base = Number(BASE_PRICES?.[name] ?? idx + 1);
      const live = Number(effectiveBlockPrices?.[idx]);
      const delta = Number.isFinite(live) ? live - base : 0;
      return {
        name,
        minted,
        bonus: BACKGROUND_BONUSES[idx] ?? 0,
        delta,
      };
    });
  }, [
    collectionBlockNames,
    effectiveBackgroundMintCounts,
    effectiveBlockPrices,
  ]);


  const userBlockCounts = React.useMemo(() => {
    const counts = new Array(10).fill(0);
    const arr = Array.isArray(items) ? items : [];
    for (const it of arr) {
      if (!it || it.isTicket) continue;
      const attrs = Array.isArray(it.meta?.attributes)
        ? it.meta.attributes
        : [];
      const blockIdAttr = attrs.find((a) =>
        ["block id", "block"].includes(
          String(a?.trait_type || "").toLowerCase(),
        ),
      );
      let idx = 0;
      if (blockIdAttr && !Number.isNaN(Number(blockIdAttr.value))) {
        const n = Math.max(1, Math.min(10, Number(blockIdAttr.value)));
        idx = n - 1;
      } else {
        const eyeAttr = attrs.find((a) => {
          const t = String(a?.trait_type || "").toLowerCase();
          return ["block/eye color", "eye color", "eyes"].includes(t);
        });
        if (eyeAttr && eyeAttr.value) {
          const u = String(eyeAttr.value).trim().toUpperCase();
          const pos = safeBlockNames.indexOf(u);
          if (pos !== -1) idx = pos;
        }
      }
      if (idx >= 0 && idx < 10) counts[idx] += 1;
    }
    return counts;
  }, [items, safeBlockNames]);

  const userUnitsByBlock = React.useMemo(
    () => userBlockCounts.map((c, i) => c * WEIGHTS[i]),
    [userBlockCounts, WEIGHTS],
  );
  const userTotalUnits = React.useMemo(
    () => userUnitsByBlock.reduce((a, b) => a + b, 0),
    [userUnitsByBlock],
  );

  const unitsToTokenAmountStr = (units) => {
    try {
      if (!unitRewardWei || !Number.isFinite(units))
        return `${units} ${tokenSymbol}`;
      const amountWei = _mul(unitRewardWei, units || 0);
      const s = _formatUnits(amountWei, tokenDecimals);
      const n = Number(s);
      return `${Number.isFinite(n) ? n.toFixed(n >= 1 ? 3 : 6) : s} ${tokenSymbol}`;
    } catch {
      return `${units} ${tokenSymbol}`;
    }
  };

  const fmtPOL = (bn) => {
    try {
      const n = Number(_formatEther(bn));
      return Number.isFinite(n) ? n.toFixed(4) : "-";
    } catch {
      return "-";
    }
  };

  const mainStats = (
    <div className="live-stats-main-flex" style={statsMainFlex}>
      {onlyTickets && (
        <div
          style={{
            width: "100%",
            marginBottom: 10,
            padding: isPhone ? "10px 12px" : "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,232,0,0.35)",
            background: "rgba(255,232,0,0.08)",
            color: "#ffe800",
            fontWeight: 700,
            textAlign: "center",
            fontSize: isPhone ? 11 : 12,
            lineHeight: 1.45,
            minHeight: isPhone ? 200 : 216,
          }}
        >
          Top buttons: Collection (Blocks, Backgrounds, Collection Stats).
          <div
            aria-hidden="true"
            style={{
              height: 1,
              background:
                "linear-gradient(90deg, transparent, rgba(255,232,0,0.6), transparent)",
              margin: "6px auto",
              width: "70%",
            }}
          />
          Bottom buttons: Token and tokenomics (weekly rewards, allocation, tools).
        </div>
      )}
      <div style={columnCenter}>
        <div
          className="image-table"
          style={{
            width: isPhone ? "100%" : imageBox,
            height: isPhone ? "auto" : imageBox,
            minHeight: imageBox,
            maxWidth: mobileMaxWidth,
            alignSelf: isPhone ? "center" : undefined,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "0",
            backgroundImage: 'url("/images/blocks-bg.png")',
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            borderRadius: 16,
            boxShadow: "0 6px 20px rgba(0,0,0,0.6), 0 0 12px #ffe800",
            border: "1px solid rgba(255, 232, 0,0.5)",
            padding: isPhone ? "8px" : "10px",
          }}
        >
          <img
            src={lastImage}
            alt="Last Minted NFT"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              borderRadius: 12,
              boxShadow: "0 4px 14px rgba(0,0,0,0.6)",
              transition: "all 0.3s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow =
                "0 6px 25px rgba(0,0,0,0.7), 0 0 18px #ffe800";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.6)";
            }}
          />
        </div>

        <div
          className="live-stats-info"
          style={{
            ...statsTable,
            width: infoBoxWidth,
            height: infoBoxHeight,
            minHeight: infoBoxMinHeight,
            maxWidth: mobileMaxWidth,
            alignSelf: isPhone ? "center" : undefined,
            marginTop: isPhone ? "0" : "8px",
            gap: isPhone ? 4 : 6,
            paddingBottom: isPhone ? "10px" : "14px",
            color: "#ffe800",
          }}
        >
          <div
            style={{
              color: "#fff",
              textTransform: "uppercase",
              fontSize: infoCardFontSize,
            }}
          >
            LAST NFT:&nbsp;
            <span className="highlight" style={{ color: "#ff0000" }}>
              #{lastNftId}
            </span>
          </div>
          <div
            style={{
              color: "#fff",
              textTransform: "uppercase",
              fontSize: infoCardFontSize,
            }}
          >
            BLOCK:&nbsp;
            <span className="highlight">
              {String(lastBlockName || "-").toUpperCase()}
            </span>
          </div>
          <div
            style={{
              color: "#fff",
              textTransform: "uppercase",
              fontSize: infoCardFontSize,
            }}
          >
            BACKGROUND:&nbsp;
            <span className="highlight">
              {String(lastBackgroundName || "-").toUpperCase()}
            </span>
          </div>
          <div>
            <span
              className="highlight"
              style={{
                color: "#5ddcff",
                fontSize: infoCardBigFontSize,
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              {computedFinalPrice !== null ? `${computedFinalPrice} POL` : "-"}
            </span>
          </div>
        </div>
      </div>

      <div style={statsGroupStyle}>
        <div style={statsTable}>
          <div className="widget-title" style={titleStyle}>
            TICKETS LEFT
          </div>
          <div style={{ fontSize: boxFontSize }}>
            <span className="highlight" style={{ color: "#ffe800" }}>
              {Math.max(0, (maxTickets || 0) - (ticketMinted || 0))}
            </span>{" "}
            / <span style={{ color: "#fff" }}>{maxTickets}</span>
          </div>
          <div
            className="widget-title"
            style={{ ...titleStyle, marginTop: isPhone ? 6 : 8 }}
          >
            NFT MINTED
          </div>
          <div style={{ fontSize: boxFontSize }}>
            <span className="highlight" style={{ color: "#ffe800" }}>
              {biggiMinted}
            </span>{" "}
            / <span style={{ color: "#fff" }}>{maxSupply}</span>
          </div>
        </div>

        <div style={ticketPriceTable}>
          <div className="widget-title" style={titleStyle}>
            TICKET PRICE
          </div>
          <div>
            <span
              className="highlight"
              style={{
                color: "#5ddcff",
                fontWeight: 900,
                fontSize: boxBigFontSize,
              }}
            >
              {typeof ticketPrice === "number"
                ? ticketPrice.toFixed(3)
                : ticketPrice || "-"}
            </span>
          </div>
        </div>
      </div>

      <div style={statsGroupStyle}>
        <div style={statsTable}>
          <div className="widget-title" style={titleStyle}>
            BIGGI PRICE
          </div>
          <div style={{ fontSize: boxFontSize }}>
            <span
              className="highlight"
              style={{
                color: "#5ddcff",
                fontWeight: 900,
                fontSize: boxBigFontSize,
              }}
            >
              {typeof biggiPrice === "number"
                ? `${biggiPrice.toFixed(biggiPrice >= 1 ? 3 : 6)} ${priceQuoteSymbol}`
                : "-"}
            </span>
          </div>
          <div
            className="widget-title"
            style={{ ...titleStyle, marginTop: isPhone ? 6 : 8 }}
          >
            24H CHANGE
          </div>
          <div
            style={{
              fontWeight: 900,
              color:
                biggiChange24h == null
                  ? "#aaa"
                  : biggiChange24h >= 0
                    ? "#47ff9a"
                    : "#ff6b6b",
              fontSize: boxFontSize,
            }}
          >
            {typeof biggiChange24h === "number"
              ? `${biggiChange24h.toFixed(2)} %`
              : "-"}
          </div>
        </div>

        <div style={ticketPriceTable}>
          <div className="widget-title" style={titleStyle}>
            SUPPLY
          </div>
          <div
            style={{ fontSize: boxFontSize, color: "#ffe800", fontWeight: 900 }}
          >
            {typeof biggiSupply === "number"
              ? biggiSupply.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              : "-"}{" "}
            {tokenSymbol}
          </div>
          <div
            className="widget-title"
            style={{ ...titleStyle, marginTop: isPhone ? 6 : 8 }}
          >
            MARKET CAP
          </div>
          <div
            style={{
              color: "#5ddcff",
              fontWeight: 900,
              fontSize: boxBigFontSize,
              whiteSpace: "nowrap",
            }}
          >
            {typeof biggiMcap === "number"
              ? `${biggiMcap.toLocaleString(undefined, { maximumFractionDigits: 0 })} POL`
              : "-"}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="live-stats-widget-new" style={widgetStyle}>
      {topButtonsRow}

      {!showBlocks && !showBgStats && !showREWARDS && (
        <>
          {mainStats}

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
              marginTop: isPhone ? 8 : 12,
            }}
          >
            <button
              ref={weeklyBtnRef}
              onClick={handleToggleWeekly}
              style={{
                ...actionBtnBase,
                background: "#000",
                color: "#ffe800",
                border: "2px solid #08ffe6",
                boxShadow: "0 0 14px rgba(8,223,255,0.25)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                willChange: "transform",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = "translateY(-2px)";
                event.currentTarget.style.boxShadow =
                  "0 0 20px rgba(8,223,255,0.4)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = "none";
                event.currentTarget.style.boxShadow =
                  "0 0 14px rgba(8,223,255,0.25)";
              }}
            >
              BIGGI WEEKLY
            </button>

            <button
              onClick={handlePoolsButtonClick}
              style={{
                ...actionBtnBase,
                background: "#000",
                color: "#ffe800",
                border: "2px solid #08ffe6",
                boxShadow: "0 0 14px rgba(255,232,0,0.25)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                willChange: "transform",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = "translateY(-2px)";
                event.currentTarget.style.boxShadow =
                  "0 0 20px rgba(255,232,0,0.4)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = "none";
                event.currentTarget.style.boxShadow =
                  "0 0 14px rgba(255,232,0,0.25)";
              }}
            >
              ALLOCATION
            </button>

            <button
              onClick={handleChatButtonClick}
              style={{
                ...actionBtnBase,
                background: "#000",
                color: "#ffe800",
                border: "2px solid #08ffe6",
                boxShadow: "0 0 14px rgba(255,232,0,0.25)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                willChange: "transform",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = "translateY(-2px)";
                event.currentTarget.style.boxShadow =
                  "0 0 20px rgba(255,232,0,0.4)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = "none";
                event.currentTarget.style.boxShadow =
                  "0 0 14px rgba(255,232,0,0.25)";
              }}
            >
              LIVE CHAT
            </button>
          </div>

          {/* WEEKLY MODAL */}
          {weeklyOpen && (
            <ModalPortal lockScroll={false}>
              <div style={modalOverlayStyle}>
                <div style={{ ...fullscreenModalFrameStyle, padding: 0 }}>
                  <div
                    style={fullscreenModalCardStyle}
                    className="wc-fullscreen-shell"
                  >
                    <button
                      type="button"
                      className="wc-fullscreen-close"
                      onClick={() => setWeeklyOpen(false)}
                      aria-label="Close weekly panel"
                    >
                      Close
                    </button>
                    <div className="wc-fullscreen-wrapper">
                      <WeeklyCountdown
                        info={weeklyCountdownInfo}
                        isClaiming={weeklyIsClaiming}
                        claimSuccess={weeklyClaimSuccess}
                        onClaim={weeklyHandleClaim}
                        onRefresh={syncWeeklyInfo}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}
          {/* ALLOCATION MODAL */}
          {poolsOpen && (
            <ModalPortal lockScroll={false}>
              <div style={modalOverlayStyle}>
                <div style={fullscreenModalFrameStyle}>
                  <div style={fullscreenModalCardStyle}>
                    <div style={modalHeaderStyle}>
                      <div style={{ color: "#ffe800", fontWeight: 900 }}>
                        ALLOCATION
                      </div>
                      <button
                        onClick={() => setPoolsOpen(false)}
                        aria-label="Close pools"
                        title="Close"
                        style={{
                          background: "transparent",
                          border: "1px solid #ffe800",
                          color: "#ffe800",
                          borderRadius: 8,
                          padding: "2px 8px",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Close
                      </button>
                    </div>

                    <div
                      className="pools-card"
                      style={{ marginTop: isPhone ? 8 : 12 }}
                    >
                      <div className="pools-card__header">
                        <div style={{ color: "#cfefff", fontSize: 12 }}>
                          Distributor:&nbsp;
                          <a
                            href={`${OKLINK_BASE}${pools?.distributor || ADDR.DISTRIBUTOR}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: "#ffe800",
                              textDecoration: "underline",
                            }}
                          >
                            {pools?.distributor || ADDR.DISTRIBUTOR}
                          </a>
                          {pools && (
                            <>
                              {" "}
                              &nbsp;|&nbsp; Balance:{" "}
                              <span
                                style={{ color: "#5ddcff", fontWeight: 800 }}
                              >
                                {fmtPOL(pools.distributorBal)} POL
                              </span>
                            </>
                          )}
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            color: "#cfefff",
                            fontSize: 12,
                          }}
                        >
                          {pools ? (
                            <>
                              Total received:{" "}
                              <span
                                style={{ color: "#5ddcff", fontWeight: 800 }}
                              >
                                {fmtPOL(pools.totalReceived)} POL
                              </span>
                              &nbsp;|&nbsp; For MAIN:{" "}
                              <span
                                style={{ color: "#5ddcff", fontWeight: 800 }}
                              >
                                {fmtPOL(pools.receivedForMain)} POL
                              </span>
                            </>
                          ) : (
                            "Loading..."
                          )}
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            color: "#9fb4c9",
                            fontSize: 11,
                          }}
                        >
                          Mint native split (5): Reserve, Buyback, Treasury,
                          Community, Collection Rewards.
                        </div>
                      </div>
                      <div className="pools-card__body">
                        <table className="pools-table" style={poolsTableStyle}>
                          <colgroup>
                            <col style={{ width: "26%" }} />
                            <col style={{ width: "54%" }} />
                            <col style={{ width: "20%" }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th
                                style={{ ...thBase, borderTopLeftRadius: 12 }}
                              >
                                Pool
                              </th>
                              <th style={thBase}>Address</th>
                              <th
                                style={{ ...thBase, borderTopRightRadius: 12 }}
                              >
                                Allocation
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(pools?.targets || []).map((t, i) => {
                              const rowBg =
                                i % 2 === 0
                                  ? "linear-gradient(120deg, rgba(255,232,0,0.08), rgba(8,223,255,0.08))"
                                  : "linear-gradient(120deg, rgba(255,232,0,0.03), rgba(8,223,255,0.04))";
                              const bal =
                                t.key && pools?.balances?.[t.key] != null
                                  ? fmtPOL(pools.balances[t.key])
                                  : "-";
                              const allocation =
                                t.key && pools?.allocations?.[t.key] != null
                                  ? fmtPOL(pools.allocations[t.key])
                                  : null;
                              const displayAllocation =
                                allocation != null && allocation !== "-"
                                  ? allocation
                                  : bal;

                              const prettyName =
                                t.key === "REWARDS"
                                  ? "COLLECTION REWARDS"
                                  : t.key === "BUYBACK"
                                    ? "BUYBACK AGENT"
                                    : t.name;
                              const keyLabel = (t.key || "")
                                .replace(/_/g, " ")
                                .toUpperCase();

                              return (
                                <tr key={t.key} style={{ background: rowBg }}>
                                  <td
                                    style={{
                                      ...tdBase,
                                      color: "#ffe800",
                                      fontWeight: 900,
                                      whiteSpace: "nowrap",
                                      textAlign: "left",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                      }}
                                    >
                                      <span>{prettyName}</span>
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 6,
                                          fontSize: 11,
                                          letterSpacing: 0.2,
                                          textTransform: "uppercase",
                                          color: "#0de6ff",
                                          padding: "2px 8px",
                                          borderRadius: 999,
                                          border:
                                            "1px solid rgba(13,230,255,0.35)",
                                          background: "rgba(13,230,255,0.09)",
                                          width: "fit-content",
                                        }}
                                      >
                                        {keyLabel || "POOL"}
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ ...tdBase, textAlign: "left" }}>
                                    <div
                                      style={{
                                        border:
                                          "1px solid rgba(255,255,255,0.12)",
                                        borderRadius: 16,
                                        padding: isPhone ? "10px" : "14px",
                                        background:
                                          "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(8,223,255,0.08))",
                                        boxShadow:
                                          "0 12px 28px rgba(0,0,0,0.35)",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 10,
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: isPhone
                                            ? "column"
                                            : "row",
                                          gap: 8,
                                          justifyContent: "space-between",
                                          alignItems: isPhone
                                            ? "flex-start"
                                            : "center",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: 11,
                                            color: "#9fb4c9",
                                            letterSpacing: 0.3,
                                          }}
                                        >
                                          Address
                                        </span>
                                        <code
                                          style={{
                                            fontFamily:
                                              "'JetBrains Mono','SFMono-Regular',monospace",
                                            fontSize: isPhone ? 11 : 12,
                                            color: "#fff",
                                            wordBreak: "break-word",
                                            lineHeight: 1.3,
                                          }}
                                          title={t.addr}
                                        >
                                          {t.addr}
                                        </code>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: isPhone
                                            ? "column"
                                            : "row",
                                          gap: 8,
                                          justifyContent: "space-between",
                                          alignItems: isPhone
                                            ? "flex-start"
                                            : "center",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: 11,
                                            color: "#9fb4c9",
                                            letterSpacing: 0.3,
                                          }}
                                        >
                                          Explorer
                                        </span>
                                        <a
                                          href={`${OKLINK_BASE}${t.addr}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{
                                            color: "#5ddcff",
                                            textDecoration: "none",
                                            fontSize: isPhone ? 11 : 12,
                                            fontWeight: 800,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 6,
                                          }}
                                        >
                                          View on OKLink
                                          <span
                                            aria-hidden="true"
                                            style={{
                                              fontSize: 14,
                                              color: "#ffe800",
                                            }}
                                          >
                                            {"\u2197"}
                                          </span>
                                        </a>
                                      </div>
                                    </div>
                                  </td>
                                  <td
                                    style={{ ...tdBase, whiteSpace: "nowrap" }}
                                  >
                                    <div
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "6px 14px",
                                        borderRadius: 999,
                                        border:
                                          "1px solid rgba(93,220,255,0.45)",
                                        background:
                                          "linear-gradient(120deg, rgba(8,223,255,0.15), rgba(255,232,0,0.12))",
                                        color: "#5ddcff",
                                        fontWeight: 900,
                                        boxShadow:
                                          "0 8px 18px rgba(0,0,0,0.35)",
                                      }}
                                    >
                                      <span>{displayAllocation}</span>
                                      <span
                                        style={{
                                          fontSize: 11,
                                          color: "#ffe800",
                                          letterSpacing: 1,
                                        }}
                                      >
                                        POL
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {(!pools || (pools.targets || []).length === 0) && (
                              <tr>
                                <td
                                  colSpan={3}
                                  style={{ ...tdBase, color: "#aaa" }}
                                >
                                  Loading...
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: isPhone ? 10 : 12,
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        onClick={() => setPoolsOpen(false)}
                        style={{
                          background: "transparent",
                          border: "1px solid #ffe800",
                          color: "#ffe800",
                          borderRadius: 8,
                          padding: "4px 14px",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}

          {/* LIVE CHAT MODAL */}
          {chatOpen && (
            <ModalPortal lockScroll={false}>
              <div style={modalOverlayStyle}>
                <div style={fullscreenModalFrameStyle}>
                  <div style={fullscreenModalCardStyle}>
                    <div style={modalHeaderStyle}>
                      <div style={{ color: "#ffe800", fontWeight: 900 }}>
                        LIVE CHAT
                      </div>
                      <button
                        onClick={() => setChatOpen(false)}
                        aria-label="Close live chat"
                        title="Close"
                        style={{
                          background: "transparent",
                          border: "1px solid #ffe800",
                          color: "#ffe800",
                          borderRadius: 8,
                          padding: "2px 8px",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Close
                      </button>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <React.Suspense fallback={null}>
                        <LiveChatPanel walletAddress={walletAddress} />
                      </React.Suspense>
                    </div>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}
        </>
      )}

      {showBlocks && (
        <React.Suspense fallback={null}>
          <BlocksWidget
            blockNames={safeBlockNames}
            blockMintCounts={effectiveBlockMintCounts}
            blockPrices={effectiveBlockPrices}
            onBack={resetAll}
          />
        </React.Suspense>
      )}

      {showBgStats && (
        <React.Suspense fallback={null}>
          <BackgroundsWidget
            blockNames={safeBlockNames}
            backgroundMintCounts={effectiveBackgroundMintCounts}
            blockPrices={effectiveBlockPrices}
            onBack={resetAll}
          />
        </React.Suspense>
      )}

      {showREWARDS && (
        <div
          className="pools-card collection-stats-card"
          style={{
            width: "min(780px, 92vw)",
            margin: "0 auto",
            borderColor: "rgba(255, 232, 0, 0.3)",
          }}
        >
          <div className="pools-card__header">
            <div style={{ color: "#ffe800", fontWeight: 900 }}>
              COLLECTION STATS
            </div>
            <button
              onClick={resetAll}
              style={{
                background: "transparent",
                border: "1px solid #ffe800",
                color: "#ffe800",
                borderRadius: 10,
                padding: "6px 12px",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Back
            </button>
          </div>
          <div className="pools-card__body">
            <div className="collection-stats-grid">
              {[
                {
                  label: "Total minted",
                  value:
                    typeof biggiMinted === "number" && Number.isFinite(biggiMinted)
                      ? `${Math.round(biggiMinted)} / ${maxSupply}`
                      : "--",
                },
                {
                  label: "Tickets minted",
                  value:
                    typeof ticketMinted === "number" && Number.isFinite(ticketMinted)
                      ? `${Math.round(ticketMinted)} / ${maxTickets}`
                      : "--",
                },
                {
                  label: "Ticket price",
                  value:
                    typeof ticketPrice === "number" && Number.isFinite(ticketPrice)
                      ? `${formatMaybe(ticketPrice, 2)} ${priceQuoteSymbol}`
                      : "--",
                },
                {
                  label: "Reward pool",
                  value:
                    typeof computedREWARDSPool === "number" &&
                    Number.isFinite(computedREWARDSPool)
                      ? `${formatMaybe(computedREWARDSPool, 2)} ${priceQuoteSymbol}`
                      : "--",
                },
                {
                  label: "Mint volume",
                  value:
                    typeof mintVolumeMatic === "number" &&
                    Number.isFinite(mintVolumeMatic)
                      ? `${formatMaybe(mintVolumeMatic, 2)} ${priceQuoteSymbol}`
                      : "--",
                },
                {
                  label: "Avg block price",
                  value:
                    typeof blockPriceStats.avg === "number" &&
                    Number.isFinite(blockPriceStats.avg)
                      ? `${formatMaybe(blockPriceStats.avg, 2)} ${priceQuoteSymbol}`
                      : "--",
                },
                {
                  label: "Highest price",
                  value:
                    typeof blockPriceStats.max === "number" &&
                    Number.isFinite(blockPriceStats.max)
                      ? `${formatMaybe(blockPriceStats.max, 2)} ${priceQuoteSymbol}`
                      : "--",
                },
                {
                  label: "Lowest price",
                  value:
                    typeof blockPriceStats.min === "number" &&
                    Number.isFinite(blockPriceStats.min)
                      ? `${formatMaybe(blockPriceStats.min, 2)} ${priceQuoteSymbol}`
                      : "--",
                },
                {
                  label: "Blocks minted",
                  value: Number.isFinite(totalBlockMinted)
                    ? totalBlockMinted.toLocaleString()
                    : "--",
                },
                {
                  label: "BG minted",
                  value: Number.isFinite(totalBackgroundMinted)
                    ? totalBackgroundMinted.toLocaleString()
                    : "--",
                },
                {
                  label: "Owned NFTs",
                  value: Number.isFinite(ownedNftCount)
                    ? ownedNftCount.toLocaleString()
                    : "--",
                },
                {
                  label: "My weekly BIGGI",
                  value: walletAddress
                    ? unitsToTokenAmountStr(userTotalUnits)
                    : "Connect wallet",
                },
              ].map((stat) => (
                <div key={stat.label} className="collection-stat-card">
                  <span className="collection-stat-label">{stat.label}</span>
                  <span className="collection-stat-value">{stat.value}</span>
                </div>
              ))}
            </div>

            <div className="collection-section-title">Block prices</div>
            <div className="collection-table-wrap">
              <table className="pools-table collection-stats-table">
                <colgroup>
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "18%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Minted</th>
                    <th>Base</th>
                    <th>Live</th>
                    <th>Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionBlockRows.map((row) => (
                    <tr key={row.name}>
                      <td
                        data-label="Block"
                        style={{ color: "#ffe800", fontWeight: 800 }}
                      >
                        {row.name}
                      </td>
                      <td data-label="Minted">{row.minted}</td>
                      <td data-label="Base">{formatMaybe(row.base, 2)}</td>
                      <td data-label="Live">
                        {row.live != null
                          ? formatMaybe(row.live, 2)
                          : formatMaybe(row.base, 2)}
                      </td>
                      <td data-label="Δ">{formatSigned(row.delta, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="collection-section-title">Background bonuses</div>
            <div className="collection-table-wrap">
              <table className="pools-table collection-stats-table">
                <colgroup>
                  <col style={{ width: "36%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "24%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Background</th>
                    <th>Minted</th>
                    <th>Bonus</th>
                    <th>Block Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionBackgroundRows.map((row, idx) => (
                    <tr key={`${row.name}-${idx}`}>
                      <td
                        data-label="Background"
                        style={{ color: "#ffe800", fontWeight: 800 }}
                      >
                        {row.name}
                      </td>
                      <td data-label="Minted">{row.minted}</td>
                      <td data-label="Bonus">{row.bonus}%</td>
                      <td data-label="Block Δ">
                        {formatSigned(row.delta, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveStats;
