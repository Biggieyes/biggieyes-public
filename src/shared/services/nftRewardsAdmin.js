import { Contract, getAddress, ZeroAddress } from "ethers";
import { BiggiNftRewards as ABI } from "@/config/abi/index.js";

const positiveInteger = (value, label, max = (1n << 256n) - 1n) => {
  const text = String(value ?? "").trim();
  if (!/^[1-9]\d*$/.test(text) || BigInt(text) > max) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return BigInt(text);
};

const address = (value) => {
  let parsed;
  try {
    parsed = getAddress(String(value || "").trim());
  } catch {
    throw new Error("A valid wallet address is required.");
  }
  if (parsed === ZeroAddress)
    throw new Error("The zero address is not a recipient.");
  return parsed;
};

export function nftAdminArguments(action, values) {
  if (action === "createManualReward") {
    const winner = address(values.winner);
    const uri = String(values.uri || "").trim();
    if (!uri) throw new Error("Metadata URI is required.");
    return [winner, uri];
  }
  if (action === "createMysteryEvent") {
    // Metadata URIs may contain commas (including data URIs).
    const uris = String(values.uris || "")
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean);
    const eligible = [
      ...new Set(
        String(values.eligible || "")
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map(address),
      ),
    ];
    if (!uris.length || !eligible.length)
      throw new Error("Reward URIs and eligible wallets are required.");
    if (uris.length > eligible.length)
      throw new Error("Each reward needs a different eligible wallet.");
    return [uris, eligible];
  }
  if (["requestMysteryRandom", "retryMysteryRandom"].includes(action)) {
    return [positiveInteger(values.eventId, "Event ID")];
  }
  if (action === "setMysteryRetryDelay") {
    return [positiveInteger(values.delay, "Retry delay", (1n << 64n) - 1n)];
  }
  throw new Error("Unsupported NFT Rewards V2 action.");
}

export async function submitNftAdminAction({
  address: target,
  action,
  values,
  signer,
  walletAddress,
}) {
  const args = nftAdminArguments(action, values);
  if (Number((await signer?.provider?.getNetwork())?.chainId) !== 137) {
    throw new Error("Switch to Polygon mainnet (137).");
  }
  const signerAddress = await signer.getAddress();
  if (
    signerAddress.toLowerCase() !== String(walletAddress || "").toLowerCase()
  ) {
    throw new Error("Wallet account changed. Reconnect and try again.");
  }
  const contract = new Contract(target, ABI, signer);
  if ((await contract.owner()).toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(
      "Only the NFT Rewards contract owner can perform this action.",
    );
  }
  // Require the V2 interface before requesting a signature.
  await contract.usedVrfRequestIds(0);
  if (["requestMysteryRandom", "retryMysteryRandom"].includes(action)) {
    const event = await contract.events(args[0]);
    if (Number(event.kind) !== 3 || event.finished)
      throw new Error("This event is not an unfinished mystery draw.");
    if (action === "requestMysteryRandom" && event.randomnessRequested)
      throw new Error("A VRF request is already pending.");
    if (action === "retryMysteryRandom") {
      if (!event.randomnessRequested || !event.vrfRequestId)
        throw new Error("No VRF request is pending.");
      const requestedAt = await contract.vrfRequestedAt(event.vrfRequestId);
      const delay = await contract.mysteryRetryDelay();
      const block = await signer.provider.getBlock("latest");
      if (!requestedAt || BigInt(block.timestamp) < requestedAt + delay)
        throw new Error("The VRF retry delay has not elapsed.");
    }
  }
  const method = contract[action];
  const gas = await method.estimateGas(...args);
  const tx = await method(...args, { gasLimit: (gas * 120n) / 100n });
  const receipt = await tx.wait(1);
  if (Number(receipt?.status) !== 1)
    throw new Error("Transaction was not confirmed successfully.");
  const result = { hash: receipt.hash || tx.hash };
  for (const log of receipt.logs || []) {
    if (log.address?.toLowerCase() !== target.toLowerCase()) continue;
    let parsed;
    try {
      parsed = contract.interface.parseLog(log);
    } catch {
      continue;
    }
    if (parsed?.name === "RewardEventCreated") {
      result.eventId = String(parsed.args.eventId);
      result.rewardId = String(parsed.args.startRewardId);
    }
    if (parsed?.name === "MysteryRandomRequested")
      result.requestId = String(parsed.args.requestId);
    if (parsed?.name === "MysteryRandomRetried")
      result.requestId = String(parsed.args.newRequestId);
  }
  return result;
}
