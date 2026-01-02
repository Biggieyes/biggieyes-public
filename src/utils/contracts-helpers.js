export async function callFirst(contract, candidates, args = []) {
  for (const fn of candidates) {
    const callable = contract?.[fn];
    if (typeof callable === "function") {
      try {
        const res = await callable(...args);
        return res;
      } catch {
        // ignore and try next candidate
      }
    }
  }
  return null;
}

export function getRO(contractRef, getReadOnlyContract) {
  if (contractRef?.current) return contractRef.current;
  if (typeof getReadOnlyContract === "function") return getReadOnlyContract();
  return null;
}
