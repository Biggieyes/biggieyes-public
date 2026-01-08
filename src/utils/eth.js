// src/utils/eth.js
// Shared ethers helpers for Moderator Center.
import { getAddress, formatUnits, parseUnits } from "ethers";
import moderatorsREWARDSAbi from "../abis/ModeratorsREWARDS.json";
import {
  getSharedFallbackProvider,
  createJsonRpcProvider,
} from "../web3/rpcProviders";

const MOD_REWARDS_ADDRESS =
  import.meta.env.VITE_MOD_REWARDS_CONTRACT ||
  import.meta.env.VITE_MOD_REWARDS_ADDRESS ||
  "";
const CHAIN_RPC_URL =
  import.meta.env.VITE_MOD_CHAIN_RPC || import.meta.env.VITE_JSON_RPC_URL || "";
const OWNER_ADDRESS = import.meta.env.VITE_MOD_OWNER_ADDRESS || "";

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
  const target = signer ? provider.getSigner() : provider;
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


