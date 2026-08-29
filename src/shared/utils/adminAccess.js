import { getAddress } from "ethers";

export const POLYGON_MAINNET_CHAIN_ID = 137;

export function normalizeAdminAddress(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return getAddress(raw);
  } catch {
    return "";
  }
}

export function sameAdminAddress(left, right) {
  const normalizedLeft = normalizeAdminAddress(left);
  const normalizedRight = normalizeAdminAddress(right);
  return (
    Boolean(normalizedLeft && normalizedRight) &&
    normalizedLeft === normalizedRight
  );
}

export function getAdminAccessState({
  walletAddress,
  ownerAddress,
  chainId,
  expectedChainId = POLYGON_MAINNET_CHAIN_ID,
} = {}) {
  const normalizedWallet = normalizeAdminAddress(walletAddress);
  const normalizedOwner = normalizeAdminAddress(ownerAddress);
  const normalizedChainId = Number(chainId);
  const hasWallet = Boolean(normalizedWallet);
  const hasOwner = Boolean(normalizedOwner);
  const chainKnown =
    Number.isFinite(normalizedChainId) && normalizedChainId > 0;
  const chainMatches =
    chainKnown && normalizedChainId === Number(expectedChainId);
  const ownerMatches =
    hasWallet && hasOwner && normalizedWallet === normalizedOwner;

  return {
    walletAddress: normalizedWallet,
    ownerAddress: normalizedOwner,
    chainId: chainKnown ? normalizedChainId : null,
    expectedChainId: Number(expectedChainId),
    chainMatches,
    ownerMatches,
    canWrite: chainMatches && ownerMatches,
  };
}

export async function assertAdminSigner({
  provider,
  ownerAddress,
  expectedChainId = POLYGON_MAINNET_CHAIN_ID,
} = {}) {
  if (!provider?.getNetwork || !provider?.getSigner) {
    throw new Error("Wallet provider is unavailable");
  }

  const network = await provider.getNetwork();
  const chainId = Number(network?.chainId);
  if (chainId !== Number(expectedChainId)) {
    throw new Error(
      `Wrong network. Switch the wallet to Polygon mainnet (${expectedChainId}).`,
    );
  }

  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();
  if (!sameAdminAddress(signerAddress, ownerAddress)) {
    throw new Error("Connected wallet is not the contract owner");
  }

  return {
    signer,
    signerAddress: normalizeAdminAddress(signerAddress),
    chainId,
  };
}
