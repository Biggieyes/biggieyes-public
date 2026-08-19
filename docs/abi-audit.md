# ABI Usage Audit

Last verified: 2026-08-17

## Purpose

This check scans frontend contract calls and confirms that called methods are present in local ABI JSON files. It helps catch runtime errors such as `contract.method is not a function` before deployment.

## How To Run

```bash
npm run check:abis
```

or:

```bash
node scripts/check-abis.js
```

## What It Scans

- Source files: `src/**/*.{js,jsx,ts,tsx}`
- ABI JSON files: `src/config/abi/**/*.json` and `src/abis/**/*.json`

## Current Result

Latest expected result:

- 58 ABI files
- 801 unique ABI functions
- no blocking ABI usage mismatch reported

## Notes And Limitations

- The checker is heuristic-based and focuses on variables created from ethers `Contract` instances or known contract factory helpers.
- It ignores provider methods, common JavaScript helpers, and runtime helper methods injected by frontend utilities.
- Dynamic calls such as `contract[method]()` are not fully provable by static analysis.
- `npm run check:contracts` separately compares seven critical frontend CORE ABI files byte-for-byte against `CORE/CORE_ABI`; the heuristic check is not the only ABI gate.

## Required Rule

Run `npm run check:abis` after:

- adding or replacing ABI JSON files
- changing contract factories
- adding a new frontend call into a contract
- syncing artifacts from backend contracts
