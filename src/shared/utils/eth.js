// src/utils/eth.js
// Shared ethers helpers for Moderator Center.
import {
  Contract,
  BrowserProvider,
  getAddress,
  formatUnits,
  parseUnits,
  keccak256,
  toUtf8Bytes,
  ZeroHash,
} from "ethers";
import { ModeratorCenter as moderatorsREWARDSAbi } from "../../config/abi/index.js";
import { ADDR } from "./addresses";
import {
  getSharedFallbackProvider,
  createJsonRpcProvider,
  getRpcUrls,
} from "../../web3/rpcProviders";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function firstNonZeroAddress(...values) {
  for (const value of values) {
    const raw = String(value || "").trim();
    if (!raw || raw.toLowerCase() === ZERO_ADDRESS) continue;
    return raw;
  }
  return "";
}

const MOD_REWARDS_ADDRESS = firstNonZeroAddress(
  import.meta.env.VITE_MOD_REWARDS_CONTRACT,
  import.meta.env.VITE_MOD_REWARDS_ADDRESS,
  ADDR.BIGGI_MODERATOR_CENTER,
);
const RAW_CHAIN_RPC_URL =
  import.meta.env.VITE_MOD_CHAIN_RPC ||
  import.meta.env.VITE_RPC_URL_ACTIVE_CHAIN ||
  import.meta.env.VITE_JSON_RPC_URL ||
  "";

function resolveChainRpcUrl() {
  try {
    return getRpcUrls()?.[0] || RAW_CHAIN_RPC_URL;
  } catch {
    return RAW_CHAIN_RPC_URL;
  }
}

const CHAIN_RPC_URL = resolveChainRpcUrl();
const OWNER_ADDRESS = firstNonZeroAddress(
  import.meta.env.VITE_MOD_OWNER_ADDRESS,
  ADDR.OWNER,
  ADDR.EXPECT_OWNER,
);

export const getConfig = () => ({
  contractAddress: MOD_REWARDS_ADDRESS,
  chainRpc: CHAIN_RPC_URL,
  ownerAddress: OWNER_ADDRESS,
  abiReady:
    Array.isArray(moderatorsREWARDSAbi) && moderatorsREWARDSAbi.length > 0,
});

export const isOwner = (address) => {
  if (!OWNER_ADDRESS || !address) return false;
  return OWNER_ADDRESS.toLowerCase() === String(address).toLowerCase();
};

export const normalizeAddress = (address) => {
  if (!address) return "";
  try {
    return getAddress(address);
  } catch {
    return String(address);
  }
};

export const getReadOnlyProvider = () => {
  try {
    return getSharedFallbackProvider();
  } catch (err) {
    console.warn("Fallback RPC provider unavailable", err?.message || err);
  }
  if (CHAIN_RPC_URL) return createJsonRpcProvider(CHAIN_RPC_URL);
  if (typeof window !== "undefined" && window.ethereum) {
    return new BrowserProvider(window.ethereum, "any");
  }
  return null;
};

export const getSignerProvider = async () => {
  if (typeof window === "undefined" || !window.ethereum) return null;
  await window.ethereum
    .request?.({ method: "eth_requestAccounts" })
    .catch(() => {});
  return new BrowserProvider(window.ethereum, "any");
};

export const getModeratorsREWARDSContract = async ({ signer = false } = {}) => {
  const { contractAddress, abiReady } = getConfig();
  if (!contractAddress) throw new Error("Contract address is missing.");
  if (!abiReady) throw new Error("ModeratorsREWARDS ABI is missing.");
  const provider = signer ? await getSignerProvider() : getReadOnlyProvider();
  if (!provider) throw new Error("Provider is not available.");
  const target = signer ? await provider.getSigner() : provider;
  return new Contract(contractAddress, moderatorsREWARDSAbi, target);
};

export const formatWei = (value, decimals = 18) => {
  if (value == null) return "--";
  try {
    return formatUnits(value, decimals);
  } catch {
    return "--";
  }
};

export const parseWei = (value, decimals = 18) => {
  if (value == null || value === "") return 0n;
  return parseUnits(String(value), decimals);
};

export const toBytes32 = (value) => {
  if (!value) return ZeroHash;
  const raw = String(value).trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(raw)) return raw;
  return keccak256(toUtf8Bytes(raw));
};

const mapSlotInfoResult = (res) => ({
  enabled: res?.enabled ?? res?.[0] ?? null,
  isLeader: res?.isLeader ?? res?.[1] ?? null,
  payout: res?.payout ?? res?.[2] ?? null,
  passwordHash: res?.passwordHash ?? res?.[3] ?? null,
  referralHash: res?.referralHash ?? res?.[4] ?? null,
  cumulativeSales:
    res?.cumulativeSales ?? res?.cumulativeTicketSales ?? res?.[5] ?? null,
});

export const readSlotInfo = async (contract, slotId) => {
  if (!contract) throw new Error("Contract not available");
  const slot = Number(slotId);
  if (!Number.isFinite(slot)) throw new Error("Invalid slot id");
  const [slotInfoRes, slotMappingRes] = await Promise.all([
    typeof contract.getSlotInfo === "function"
      ? contract.getSlotInfo(slot).catch(() => null)
      : null,
    typeof contract.slots === "function"
      ? contract.slots(slot).catch(() => null)
      : null,
  ]);

  if (slotInfoRes || slotMappingRes) {
    const slotInfo = slotInfoRes ? mapSlotInfoResult(slotInfoRes) : {};
    const slotMapping = slotMappingRes ? mapSlotInfoResult(slotMappingRes) : {};
    return {
      enabled: slotInfo.enabled ?? slotMapping.enabled ?? null,
      isLeader: slotInfo.isLeader ?? slotMapping.isLeader ?? null,
      payout: slotInfo.payout ?? slotMapping.payout ?? null,
      passwordHash: slotMapping.passwordHash ?? slotInfo.passwordHash ?? null,
      referralHash: slotInfo.referralHash ?? slotMapping.referralHash ?? null,
      cumulativeSales:
        slotInfo.cumulativeSales ?? slotMapping.cumulativeSales ?? null,
    };
  }

  throw new Error("Slot info function not found in ABI.");
};

export const readWeekStats = async (contract, week, slotId) => {
  if (!contract) throw new Error("Contract not available");
  const w = Number(week);
  const slot = Number(slotId);
  if (!Number.isFinite(w)) throw new Error("Invalid week");
  if (!Number.isFinite(slot)) throw new Error("Invalid slot id");
  if (typeof contract.getWeekStats === "function") {
    const res = await contract.getWeekStats(w, slot);
    return {
      uniqueRefs: res?.uniqueRefs ?? res?.[0] ?? null,
      ticketSales: res?.ticketSales ?? res?.[1] ?? null,
      allocatedWei: res?.allocatedWei ?? res?.[2] ?? null,
    };
  }
  const [uniqueRefs, ticketSales, allocatedWei] = await Promise.all([
    typeof contract.weekUniqueCount === "function"
      ? contract.weekUniqueCount(w, slot).catch(() => null)
      : null,
    typeof contract.weekTicketCount === "function"
      ? contract.weekTicketCount(w, slot).catch(() => null)
      : null,
    typeof contract.weekAllocated === "function"
      ? contract.weekAllocated(w).catch(() => null)
      : null,
  ]);
  return { uniqueRefs, ticketSales, allocatedWei };
};

