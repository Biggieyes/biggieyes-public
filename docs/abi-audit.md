# ABI usage audit

Purpose
- Static check that finds contract method calls in the frontend that are not present in the local ABI JSONs.
- Helps spot ABI mismatches before runtime errors like "is not a function".

How to run
```bash
npm run check:abis
```
or
```bash
node scripts/check-abis.js
```

What it scans
- Source files: `src/**/*.{js,jsx,ts,tsx}`
- ABI JSONs: `src/config/abi/**/*.json` and `src/abis/**/*.json`

Output
- Summary: number of files, ABI files, and unique ABI functions.
- List of missing method calls with file/line and a hint of the factory used.

Notes and limitations
- Heuristic-based: focuses on variables created from `new Contract(...)` or `get*...` factories.
- Ignores service wrappers (create*Service) and dynamic calls (`contract[method]()`).
- JSON ABIs only. If you add ABI definitions in JS, convert to JSON or extend the script.

Next steps for audits
1) Run `npm run check:abis` after updating ABI files or contract addresses.
2) Review any missing methods; confirm whether ABI files are outdated or the call is wrong.
3) If the method is valid but missing, update the relevant ABI JSON.

Run log
- 2026-01-10 01:57: `npm run check:abis`
  - Parse errors: 2 (placeholder MAINHEADER ecosystem files with invalid syntax).
  - Missing methods reported: 144 (includes false positives like provider calls and string helpers).
  - Action: tighten filters (ignore provider methods, non-contract objects) or fix placeholders.
- 2026-01-10 02:00: `npm run check:abis`
  - Parse errors: 0 (MAINHEADER BiggiToken placeholders skipped).
  - Missing methods reported: 83 (mostly POLICY/REWARDS reader + Treasury/Distributor ABI gaps).
  - Action: update ABI files or adapt calls for the listed methods.
- 2026-01-10 02:14: `npm run check:abis`
  - Missing methods reported: 55 (POLICY methods resolved; remaining gaps are REWARDS/Treasury/Distributor + a few contract helpers).
  - Action: update remaining ABI files or downgrade calls where contracts don't support them.

Solidity compare runs
- 2026-01-10 03:26: `node scripts/compare-sol-abi.js`
  - Note: skipped `BiggiMAIN.sol` (obsolete; `BIGGIMAINVRF` is collection1).
  - Mismatches: 36, Unmapped: 23 (see console output for details).
- 2026-01-10 03:34: `node scripts/compare-sol-abi.js`
  - Updated `src/config/abi/BiggiMain.json` for MAIN1/COLLECTION1/MAINVRF.
  - Mismatches: 36, Unmapped: 23 (BIGGIMAINVRF still missing 6 methods vs local sol).
- 2026-01-10 03:47: `node scripts/compare-sol-abi.js`
  - Synced ABI files from `biggi-project/bekend/artifacts/contracts/abi_synced` (excluded manual ABIs).
  - Note: mismatches still include inherited/interface methods (script is heuristic).
  - Mismatches: 36, Unmapped: 23.
