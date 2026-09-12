import { multicallReadContract } from "@/shared/utils/multicall.js";

export function parseModeratorWeek(value) {
  const text = String(value ?? "");
  if (!/^\d+$/.test(text))
    throw new Error("Enter a whole, non-negative week ID.");
  const week = Number(text);
  if (!Number.isSafeInteger(week) || week > 1000000) {
    throw new Error("Week ID is out of range.");
  }
  return week;
}

export async function readModeratorWeek(contract, requestedWeek = null) {
  const selected =
    requestedWeek == null ? null : parseModeratorWeek(requestedWeek);
  const provider = contract.runner;
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 137)
    throw new Error("Polygon mainnet is required.");
  const block = await provider.getBlock("latest");
  if (!block) throw new Error("Latest Polygon block is unavailable.");
  const week = selected ?? Math.floor(block.timestamp / 604800);
  const entries = [
    { method: "currentWeek" },
    { method: "WEEK" },
    { method: "SETTLEMENT_DELAY" },
    { method: "weekConfigVersion", params: [week] },
    { method: "weekSettled", params: [week] },
    { method: "weekAllocated", params: [week] },
    { method: "weekDistributed", params: [week] },
    { method: "weekRolledOver", params: [week] },
  ];
  const read = (calls) =>
    multicallReadContract(provider, contract, calls, null, {
      blockTag: block.number,
    });
  const state = await read(entries);
  if (!state || entries.some(({ method }) => state[method] == null)) {
    throw new Error("Weekly contract data is incomplete.");
  }
  const opened = BigInt(state.weekConfigVersion) > 0n;
  const rows = [];
  if (opened) {
    const calls = Array.from({ length: 10 }, (_, slot) => [
      { key: `slot${slot}`, method: "getWeekSlotConfig", params: [week, slot] },
      { key: `stats${slot}`, method: "getWeekStats", params: [week, slot] },
      { key: `weight${slot}`, method: "getWeekWeight", params: [week, slot] },
    ]).flat();
    const data = await read(calls);
    if (!data || calls.some(({ key }) => data[key] == null)) {
      throw new Error("Weekly slot data is incomplete.");
    }
    for (let slotId = 0; slotId < 10; slotId += 1) {
      const slot = data[`slot${slotId}`];
      const stats = data[`stats${slotId}`];
      rows.push({
        slotId,
        enabled: slot.enabled ?? slot[0],
        isLeader: slot.isLeader ?? slot[1],
        payout: slot.payout ?? slot[2],
        uniqueBuyers: String(stats.uniqueRefs ?? stats[0]),
        paidTickets: String(stats.ticketSales ?? stats[1]),
        weight: String(data[`weight${slotId}`]),
      });
    }
  }
  const startsAt = week * Number(state.WEEK);
  const endsAt = startsAt + Number(state.WEEK);
  const settlesAt = endsAt + Number(state.SETTLEMENT_DELAY);
  const status = !opened
    ? "Not opened"
    : state.weekSettled
      ? "Settled"
      : block.timestamp >= settlesAt
        ? "Awaiting settlement"
        : block.timestamp >= endsAt
          ? "Settlement delay"
          : "In progress";
  return {
    chainId: 137,
    contract: contract.target,
    blockNumber: block.number,
    blockTimestamp: block.timestamp,
    week,
    currentWeek: Number(state.currentWeek),
    startsAt,
    endsAt,
    settlesAt,
    opened,
    status,
    configVersion: String(state.weekConfigVersion),
    settled: Boolean(state.weekSettled),
    allocatedWei: String(state.weekAllocated),
    creditedWei: String(state.weekDistributed),
    rolledOverWei: String(state.weekRolledOver),
    slots: rows,
  };
}
