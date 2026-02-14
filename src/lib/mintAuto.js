// src/lib/mintAuto.js
import {
  getMainRW,
  resolveTicketPriceWeiFromHub,
  ensureAmoy,
} from "@/shared/utils/contract";

function pickMintName(c) {
  const prefer = [
    "mint",
    "buyTicket",
    "purchase",
    "mintTicket",
    "mintWithVRF",
    "buy",
  ];
  const have = prefer.filter((n) => typeof c[n] === "function");
  if (have.length) return have[0];

  const frags = (c.interface?.fragments || []).filter(
    (f) =>
      f.type === "function" &&
      ["payable", "nonpayable"].includes(f.stateMutability) &&
      f.inputs &&
      f.inputs.length <= 1 &&
      /mint|buy|purchase/i.test(f.name),
  );
  return frags[0]?.name || null;
}

/**
 * Mint qty items.
 * - ensure POL Amoy
 * - send value = priceWei * qty when payable
 * - try call without param and with qty
 */
export async function mintAuto(qty = 1) {
  if (!Number.isFinite(qty) || qty <= 0) qty = 1;

  // switch/add POL Amoy before getting signer contract
  await ensureAmoy();

  const c = await getMainRW();
  const fn = pickMintName(c);
  if (!fn)
    throw new Error("Contract does not expose a recognized mint function.");

  // check payable
  const fragment = c.interface.getFunction(fn);
  const isPayable = fragment?.stateMutability === "payable";

  // price per item
  const unitWeiBN = BigInt(await resolveTicketPriceWeiFromHub());
  // total
  const totalValue = isPayable
    ? unitWeiBN * BigInt(qty)
    : 0n;

  // gas estimate
  let gas;
  try {
    gas = await c.estimateGas?.[fn]?.({ value: totalValue });
  } catch (err) {
    console.debug("mintAuto gas estimate (no qty) failed", err);
  }
  if (!gas) {
    try {
      gas = await c.estimateGas?.[fn]?.(qty, { value: totalValue });
    } catch (err) {
      console.debug("mintAuto gas estimate (with qty) failed", err);
    }
  }
  const gasLimit =
    gas != null
      ? typeof gas === "bigint"
        ? (gas * 12n) / 10n
        : gas?._isBigNumber && typeof gas.mul === "function"
          ? gas.mul(12).div(10)
          : gas
      : null;
  const overrides = isPayable
    ? gasLimit
      ? { value: totalValue, gasLimit }
      : { value: totalValue }
    : gasLimit
      ? { gasLimit }
      : {};

  try {
    return await c[fn](overrides);
  } catch (err) {
    console.debug("mintAuto direct call failed, retrying with qty", err);
    return await c[fn](qty, overrides);
  }
}

/** Optional: mint and wait for confirmation */
export async function mintAutoAndWait(qty = 1) {
  const tx = await mintAuto(qty);
  return await tx.wait();
}

