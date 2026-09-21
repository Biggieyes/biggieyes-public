import { CORE_CHAPTERS } from "./addresses.js";

const same = (a, b) =>
  Boolean(a && b) && String(a).toLowerCase() === String(b).toLowerCase();
const key = (account) =>
  `biggi:pending-vrf:137:${String(account).toLowerCase()}`;

export function normalizePendingVrf(value, account) {
  const chapter = CORE_CHAPTERS.find(
    (item) => item.chapterId === Number(value?.chapterId),
  );
  if (
    !chapter ||
    Number(value?.chainId) !== 137 ||
    !same(value?.account, account) ||
    !same(value?.collection, chapter.main)
  )
    return null;
  const requestId = String(value.requestId || "");
  const ticketId = String(value.ticketId || "");
  if (
    (requestId && !/^[1-9]\d*$/.test(requestId)) ||
    (ticketId && !/^[1-9]\d*$/.test(ticketId))
  )
    return null;
  return {
    chainId: 137,
    account,
    chapterId: chapter.chapterId,
    collection: chapter.main,
    requestId,
    ticketId,
    txHash: /^0x[\da-f]{64}$/i.test(value.txHash || "") ? value.txHash : "",
    startBlock:
      Number.isSafeInteger(value.startBlock) && value.startBlock >= 0
        ? value.startBlock
        : null,
  };
}

export function loadPendingVrf(account) {
  if (!account) return null;
  try {
    return normalizePendingVrf(
      JSON.parse(window.localStorage.getItem(key(account))),
      account,
    );
  } catch {
    return null;
  }
}

export function savePendingVrf(context) {
  const normalized = normalizePendingVrf(context, context?.account);
  if (!normalized) return null;
  try {
    window.localStorage.setItem(
      key(normalized.account),
      JSON.stringify(normalized),
    );
  } catch {
    /* Storage may be disabled. */
  }
  return normalized;
}

export function clearPendingVrf(account) {
  try {
    window.localStorage.removeItem(key(account));
  } catch {
    /* Storage may be disabled. */
  }
}

export function samePendingVrf(a, b) {
  return (
    Boolean(a && b) &&
    same(a.account, b.account) &&
    same(a.collection, b.collection) &&
    a.chainId === b.chainId &&
    a.requestId === b.requestId &&
    a.ticketId === b.ticketId
  );
}

export function pendingVrfFromReceipt(context, receipt, contract) {
  const confirmedContext = {
    ...context,
    txHash: receipt?.hash || context.txHash,
  };
  for (const log of receipt?.logs || []) {
    if (!same(log.address, context.collection)) continue;
    try {
      const parsed = contract.interface.parseLog(log);
      if (
        parsed?.name === "VRFRequested" &&
        same(parsed.args.user, context.account)
      ) {
        return {
          ...confirmedContext,
          requestId: String(parsed.args.requestId),
          ticketId: String(parsed.args.ticketId),
          startBlock: receipt.blockNumber,
        };
      }
      if (
        parsed?.name === "PendingMintRetried" &&
        same(parsed.args.user, context.account)
      ) {
        return {
          ...confirmedContext,
          requestId: String(parsed.args.newRequestId),
          ticketId: String(parsed.args.ticketId),
          startBlock: receipt.blockNumber,
        };
      }
    } catch {
      /* Other events in the same receipt are not VRF requests. */
    }
  }
  return confirmedContext;
}

export function findVrfCompletionInReceipt(context, receipt, contract) {
  if (
    !context?.requestId ||
    !same(contract?.target || contract?.address, context.collection)
  )
    return null;

  let fulfillmentStarted = false;
  let minted = null;
  for (const log of receipt?.logs || []) {
    if (!same(log.address, context.collection)) continue;
    try {
      const parsed = contract.interface.parseLog(log);
      if (
        parsed?.name === "VRFFulfillStarted" &&
        String(parsed.args?.requestId ?? parsed.args?.[0]) ===
          String(context.requestId) &&
        same(parsed.args?.minter ?? parsed.args?.[1], context.account)
      ) {
        fulfillmentStarted = true;
      }
      if (
        parsed?.name === "NFTMinted" &&
        same(parsed.args?.minter ?? parsed.args?.[0], context.account)
      ) {
        minted = parsed;
      }
    } catch {
      /* Other receipt logs are unrelated to this VRF completion. */
    }
  }
  return fulfillmentStarted && minted ? minted : null;
}

// With a remembered request, zero pending is not proof of a completed mint.
export async function resolvePendingVrf({
  account,
  provider,
  preferred,
  getContract,
}) {
  const known = normalizePendingVrf(preferred, account);
  const observedBlock =
    known?.startBlock ?? (await provider?.getBlockNumber?.()) ?? null;
  const chapters = known
    ? CORE_CHAPTERS.filter((c) => c.chapterId === known.chapterId)
    : CORE_CHAPTERS;
  for (const chapter of chapters) {
    const contract = getContract(chapter.chapterId, provider);
    const request = await contract.pendingMintRequest(account);
    if (request == null) throw new Error("VRF pending state unavailable");
    if (BigInt(request) > 0n) {
      const ticketId = await contract.pendingTicketId(request);
      return {
        contract,
        context: {
          ...(known || {}),
          chainId: 137,
          account,
          chapterId: chapter.chapterId,
          collection: chapter.main,
          requestId: String(request),
          ticketId: String(ticketId),
          startBlock: observedBlock,
        },
      };
    }
    if (known) {
      let context = known;
      if (
        !context.requestId &&
        context.txHash &&
        provider?.getTransactionReceipt
      ) {
        const receipt = await provider.getTransactionReceipt(context.txHash);
        if (receipt && Number(receipt.status) === 0) {
          return { contract, context, reverted: true };
        }
        if (Number(receipt?.status) === 1)
          context = pendingVrfFromReceipt(context, receipt, contract);
      }
      return { contract, context };
    }
  }
  return null;
}

export async function findVrfCompletion(context, contract, queryLogs, latest) {
  if (
    !context?.requestId ||
    !same(contract.target || contract.address, context.collection)
  )
    return null;
  const from = context.startBlock ?? Math.max(0, latest - 120_000);
  const starts = await queryLogs(
    contract,
    contract.filters.VRFFulfillStarted(),
    from,
    latest,
  );
  const started = starts.filter(
    (log) =>
      String(log.args?.requestId ?? log.args?.[0]) === context.requestId &&
      same(log.args?.minter ?? log.args?.[1], context.account),
  );
  if (contract.filters.PendingMintEmergencyResolved) {
    const emergency = await queryLogs(
      contract,
      contract.filters.PendingMintEmergencyResolved(context.account),
      from,
      latest,
    );
    started.push(
      ...emergency.filter(
        (log) =>
          String(log.args?.requestId ?? log.args?.[1]) === context.requestId &&
          same(log.args?.user ?? log.args?.[0], context.account),
      ),
    );
  }
  if (!started.length) return null;
  const minted = await queryLogs(
    contract,
    contract.filters.NFTMinted(context.account),
    from,
    latest,
  );
  return (
    minted.find(
      (log) =>
        same(log.args?.minter ?? log.args?.[0], context.account) &&
        log.transactionHash &&
        started.some((start) => start.transactionHash === log.transactionHash),
    ) || null
  );
}
