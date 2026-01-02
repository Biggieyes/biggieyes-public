import { ethers } from "ethers";
import { ensureAmoy, getMain as getContract } from "./contract";

export const parseEth = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) throw new Error("Invalid number");
  return ethers.utils.parseEther(String(num));
};

export const writeTx = async (fn, ...args) => {
  const c = await getContract();
  const name = fn.name;
  // try estimateGas first; fall back to sending if unavailable
  if (name && c.estimateGas?.[name]) {
    await c.estimateGas[name](...args);
  }
  const tx = await fn(...args);
  await tx.wait();
};

export const writeFirst = async (targets, names, ...args) => {
  await ensureAmoy();
  for (const get of targets) {
    let c;
    try {
      c = await get();
    } catch {
      // ignore and try next target
    }
    if (!c) continue;
    for (const name of names) {
      const fn = c?.[name];
      if (typeof fn === "function") {
        await writeTx(fn.bind(c), ...args);
        return true;
      }
    }
  }
  throw new Error(`No matching method found (${names.join(" | ")}) on provided contracts`);
};

export const setVRFAllOrPartial = async (vrf) => {
  const targets = [getContract];
  const combinedNames = ["setVRFParams", "setVrfParams", "configureVRF", "configureVrf", "setChainlinkVRF"];
  const argsCombo = [
    [vrf.keyHash, vrf.confirmations, vrf.callbackGasLimit, vrf.numWords, vrf.coordinator, vrf.subscriptionId],
    [vrf.keyHash, vrf.confirmations, vrf.numWords, vrf.callbackGasLimit, vrf.coordinator, vrf.subscriptionId],
  ];
  for (const a of argsCombo) {
    try {
      await writeFirst(targets, combinedNames, ...a);
      return;
    } catch {
      // continue trying other combinations
    }
  }
  const c = await getContract();
  const trySet = async (name, ...a) => {
    if (typeof c[name] === "function") await writeTx(c[name].bind(c), ...a);
  };
  await ensureAmoy();
  try {
    await trySet("setKeyHash", vrf.keyHash);
  } catch {
    // ignore, try next param
  }
  try {
    await trySet("setRequestConfirmations", vrf.confirmations);
  } catch {
    // ignore, try next param
  }
  try {
    await trySet("setCallbackGasLimit", vrf.callbackGasLimit);
  } catch {
    // ignore, try next param
  }
  try {
    await trySet("setNumWords", vrf.numWords);
  } catch {
    // ignore, try next param
  }
  try {
    await trySet("setCoordinator", vrf.coordinator);
  } catch {
    // ignore, try next param
  }
  try {
    await trySet("setSubscriptionId", vrf.subscriptionId);
  } catch {
    // ignore final param
  }
};
