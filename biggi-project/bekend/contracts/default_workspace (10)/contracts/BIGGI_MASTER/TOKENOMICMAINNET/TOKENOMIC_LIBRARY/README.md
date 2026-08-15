# BIGGI Tokenomic Library

Shared Solidity libraries used by the tokenomic mainnet branch in `TOKENOMICMAINNET`.

Deployment status: libraries are compile-time/deployment support for the live Polygon tokenomics stack as of 2026-06-16.

Current library ABI snapshots are exported in `../ABI/` and are matched against `artifacts-master`.
Internal-only libraries have empty ABI snapshots by design.

## Files

- `BiggiBpsLib.sol`: basis-point constants for mint/distributor splits and treasury split logic; the tokenomics branch imports it in `BiggiTreasury.sol`.
- `BiggiCapsLib.sol`: BIGGI token supply caps, branch caps, and initial distribution constants.
- `BiggiErrorsLib.sol`: shared custom errors for tokenomic contracts.
- `BiggiIdIndexLib.sol`: retained ID/index helper library used by compatibility branches.
- `BiggiSwapLib.sol`: swap quoting and path helpers for buyback and liquidity flows.

## Current ABI Snapshot Data

- `BiggiBpsLib.abi.json` - 0 items, internal helper only.
- `BiggiCapsLib.abi.json` - 9 items, public cap constants.
- `BiggiErrorsLib.abi.json` - 26 items, shared custom errors.
- `BiggiIdIndexLib.abi.json` - 0 items, internal helper only.
- `BiggiSwapLib.abi.json` - 0 items, internal helper only.

## Current BIGGI Cap Constants

- total supply cap: `2_200_000_000 * 1e18`
- initial drip distributor allocation: `200_000_000 * 1e18`
- initial token rewards allocation: `200_000_000 * 1e18`
- initial marketing support allocation: `200_000_000 * 1e18`
- initial reserve allocation: `600_000_000 * 1e18`
- guardian DEX mint budget: `500_000_000 * 1e18`
- guardian rewards mint budget: `500_000_000 * 1e18`
- drip distributor total cap: initial drip cap + guardian DEX mint budget
- token rewards total cap: initial rewards cap + guardian rewards mint budget

`BiggiCapsLib.sol` is intentionally synchronized with `CORE/CORE_LIBRARY/BiggiCapsLib.sol`; this is enforced by `test/master/library-consistency.smoke.test.js`.

## Focused Recheck 2026-06-03

- Library source files checked: 5.
- Library ABI package files checked against `artifacts-master`: 5, mismatches: 0.
- Full tokenomics ABI package checked against `artifacts-master`: 46 contract ABI files, mismatches: 0.
- `BiggiTreasury.sol` buyback and ecosystem BIGGI splits use `BiggiBpsLib.TREASURY_TO_REWARDS_BPS` and `BiggiBpsLib.TREASURY_TO_RESERVE_BPS`.
- Verification passed at that time; current authoritative result is the 2026-06-07 recheck below.

## Focused Recheck 2026-06-07

- Library source files checked: 5.
- Library consistency is covered by `test/master/library-consistency.smoke.test.js`.
- Full master verification: `npm run compile:master` OK, `npm run test:master` OK with 66 passing, `npm run gate:master:local` OK.
- Full tokenomics ABI package checked against `artifacts-master`: 46 contract ABI files, mismatches: 0.
- ABI-to-source check returned 25 contracts, mismatches: 0.

## Scope note

These files are support libraries only. Runtime ownership, POL flow, BIGGI flow, and pause authority live in the concrete contracts documented in `../MAINNET_CONTRACT_DOSSIERS`.
