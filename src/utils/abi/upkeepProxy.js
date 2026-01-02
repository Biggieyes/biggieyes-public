export const ABI_UPKEEP = [
  "function paused() view returns (bool)",
  "function pause()",
  "function unpause()",
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner)",
  // řetěz Upkeep
  "function checkUpkeep(bytes) view returns (bool upkeepNeeded, bytes performData)",
  "function performUpkeep(bytes performData)",
];
export default ABI_UPKEEP;
