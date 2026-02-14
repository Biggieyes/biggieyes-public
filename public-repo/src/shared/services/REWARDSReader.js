// Legacy REWARDSReader compatibility wrapper.
// Provides a concrete implementation backed by contract.js factories.

import {
  getBiggiREWARDSReaderRO,
  getBiggiREWARDSReader,
} from "../utils/contract";

export function getREWARDSReaderContract(provider) {
  return getBiggiREWARDSReaderRO(provider);
}

export async function getREWARDSReaderContractRW(signerOverride) {
  return getBiggiREWARDSReader(signerOverride);
}

// Default export for legacy compatibility.
export default {
  getREWARDSReaderContract,
  getREWARDSReaderContractRW,
};
