// src/utils/multicall.js
// Lightweight multicall helper using the standard Multicall2 aggregate interface.
import { Contract } from "ethers";
import { ADDR } from "./addresses";

const MULTICALL_ABI = [
  "function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)",
];

function _hasFn(iface, name) {
  if (!iface || !name) return false;
  try {
    iface.getFunction(name);
    return true;
  } catch {
    return false;
  }
}

function _resolveTarget(contractOrTarget) {
  if (!contractOrTarget) return null;
  if (typeof contractOrTarget === "string") return contractOrTarget;
  return contractOrTarget.target || contractOrTarget.address || null;
}

function _unwrapDecoded(decoded, unwrap = true) {
  if (!unwrap) return decoded;
  if (Array.isArray(decoded) && decoded.length === 1) return decoded[0];
  return decoded;
}

function _getMulticallAddress() {
  try {
    if (
      typeof process !== "undefined" &&
      process.env &&
      process.env.VITE_MULTICALL_ADDRESS
    )
      return process.env.VITE_MULTICALL_ADDRESS;
  } catch {
    // ignore env access errors
  }
  try {
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_MULTICALL_ADDRESS
    )
      return import.meta.env.VITE_MULTICALL_ADDRESS;
  } catch {
    // ignore env access errors
  }
  try {
    if (ADDR && ADDR.MULTICALL) return ADDR.MULTICALL;
  } catch {
    // ignore address access errors
  }
  return null;
}

/**
 * Perform multicall for given calls.
 * calls: Array<{ target: string, iface: Interface, method: string, params?: any[] }>
 * Returns: Array of decoded results (each as the decoded tuple/array returned by the method)
 */
export async function multicallAggregate(
  provider,
  calls = [],
  multicallAddress = null,
) {
  if (!Array.isArray(calls) || !calls.length) return [];
  const addr = multicallAddress || _getMulticallAddress();
  if (!addr) {
    // Fallback: execute sequential Promise.all of each call using provider.call
    const results = await Promise.all(
      calls.map(async (c) => {
        const data = c.iface.encodeFunctionData(c.method, c.params || []);
        const res = await provider.call({ to: c.target, data }).catch((e) => {
          throw e;
        });
        return c.iface.decodeFunctionResult(c.method, res);
      }),
    );
    return results;
  }

  const mc = new Contract(addr, MULTICALL_ABI, provider);
  const callInput = calls.map((c) => ({
    target: c.target,
    callData: c.iface.encodeFunctionData(c.method, c.params || []),
  }));
  const [, returnData] = await mc["aggregate"](callInput);
  return returnData.map((rd, i) =>
    calls[i].iface.decodeFunctionResult(calls[i].method, rd),
  );
}

export async function multicallReadContract(
  provider,
  contractOrTarget,
  entries = [],
  iface = null,
) {
  if (!provider || !Array.isArray(entries) || !entries.length) return null;
  const target = _resolveTarget(contractOrTarget);
  const resolvedIface = iface || contractOrTarget?.interface || null;
  if (!target || !resolvedIface) return null;

  const filtered = entries.filter(
    (entry) => entry?.method && _hasFn(resolvedIface, entry.method),
  );
  if (!filtered.length) return null;

  const decoded = await multicallAggregate(
    provider,
    filtered.map((entry) => ({
      target,
      iface: resolvedIface,
      method: entry.method,
      params: entry.params || [],
    })),
  );

  const out = {};
  filtered.forEach((entry, idx) => {
    out[entry.key || entry.method] = _unwrapDecoded(
      decoded[idx],
      entry.unwrap !== false,
    );
  });
  return out;
}

export default { multicallAggregate, multicallReadContract };
