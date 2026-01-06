// src/utils/multicall.js
// Lightweight multicall helper using the standard Multicall2 aggregate interface.
import { ethers } from "ethers";
import { ADDR } from "./addresses";

const MULTICALL_ABI = [
  "function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)",
];

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
 * calls: Array<{ target: string, iface: ethers.utils.Interface, method: string, params?: any[] }>
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

  const mc = new ethers.Contract(addr, MULTICALL_ABI, provider);
  const callInput = calls.map((c) => ({
    target: c.target,
    callData: c.iface.encodeFunctionData(c.method, c.params || []),
  }));
  const [, returnData] = await mc.aggregate(callInput);
  return returnData.map((rd, i) =>
    calls[i].iface.decodeFunctionResult(calls[i].method, rd),
  );
}

export default { multicallAggregate };
