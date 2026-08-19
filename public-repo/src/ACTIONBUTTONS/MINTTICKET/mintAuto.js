import {
  getTicketHub,
  resolveTicketPriceWeiFromHub,
  ensurePolygon,
} from "@/shared/utils/contract";
import { resolveActiveTicketChapterId } from "@/shared/utils/ticketChapters.js";

/**
 * Mint qty items.
 * - ensure Polygon mainnet
 * - require exactly one active chapter
 * - send the current ticket price to that chapter
 */
export async function mintAuto(qty = 1) {
  if (!Number.isFinite(qty) || qty !== 1) {
    throw new Error(
      "Central TicketHub mints exactly one ticket per transaction.",
    );
  }

  // switch/add Polygon mainnet before getting signer contract
  await ensurePolygon();

  const c = await getTicketHub();
  const activeChapterId = await resolveActiveTicketChapterId(c);
  const totalValue = BigInt(await resolveTicketPriceWeiFromHub());

  let gas;
  try {
    const estimate =
      c?.estimateGas?.mintTicketForChapter ||
      c?.mintTicketForChapter?.estimateGas;
    if (estimate) {
      gas = await estimate(activeChapterId, { value: totalValue });
    }
  } catch (err) {
    console.debug("mintAuto chapter gas estimate failed", err);
  }
  const gasLimit =
    gas != null
      ? typeof gas === "bigint"
        ? (gas * 12n) / 10n
        : gas?._isBigNumber && typeof gas.mul === "function"
          ? gas.mul(12).div(10)
          : gas
      : null;
  const overrides = gasLimit
    ? { value: totalValue, gasLimit }
    : { value: totalValue };

  return await c.mintTicketForChapter(activeChapterId, overrides);
}

/** Optional: mint and wait for confirmation */
export async function mintAutoAndWait(qty = 1) {
  const tx = await mintAuto(qty);
  return await tx.wait();
}
