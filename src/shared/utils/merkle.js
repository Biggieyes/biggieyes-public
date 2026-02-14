// src/utils/merkle.js
// Merkle helpers for Moderator Center (client-side utility).
import { MerkleTree } from "merkletreejs";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as ethers from "ethers";

const keccak256 = (data) => {
  const bytes = typeof data === "string" ? ethers.getBytes(data) : data;
  return `0x${bytesToHex(keccak_256(bytes))}`;
};

export const buildLeaf = (slotId, walletAddress, amountWei) => {
  const packed = ethers.solidityPacked(
    ["uint256", "address", "uint256"],
    [Number(slotId), walletAddress, amountWei],
  );
  return keccak256(packed);
};

export const buildTree = (entries = []) => {
  const leaves = entries.map((entry) =>
    buildLeaf(entry.slotId, entry.wallet, entry.amountWei),
  );
  return new MerkleTree(leaves, keccak256, { sortPairs: true });
};

export const buildRoot = (entries = []) => buildTree(entries).getHexRoot();

export const buildProofs = (entries = []) => {
  const tree = buildTree(entries);
  const proofs = entries.map((entry) => ({
    slotId: entry.slotId,
    wallet: entry.wallet,
    amountWei: entry.amountWei,
    proof: tree.getHexProof(
      buildLeaf(entry.slotId, entry.wallet, entry.amountWei),
    ),
  }));
  return { root: tree.getHexRoot(), proofs };
};

