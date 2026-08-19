# BIGGI Core Library

Deployment status: libraries are source dependencies for the live Polygon mainnet CORE deployment as of 2026-06-16.

Shared Solidity libraries used by the core collection, ticket, registry, rewards, and distributor contracts.

Current library ABI snapshots are exported in `../CORE_ABI/` and are matched against `artifacts-master`.
Internal-only libraries have empty ABI snapshots by design.

The shared library files `BiggiBpsLib.sol`, `BiggiCapsLib.sol`, `BiggiErrorsLib.sol`, `BiggiIdIndexLib.sol`, and `BiggiSwapLib.sol` are kept synchronized with their `TOKENOMICMAINNET/TOKENOMIC_LIBRARY/` copies. The master test suite includes a direct source-level consistency check for these files.

## Files
- `BiggiBpsLib.sol` - Basis-point helpers for collection distributor and treasury split math.
- `BiggiCapsLib.sol` - Shared BIGGI cap constants consumed by reward-side logic.
- `BiggiCollectionEligibilityLib.sol` - Collection reward eligibility helpers.
- `BiggiErrorsLib.sol` - Retained compatibility error set; not imported by active core contracts.
- `BiggiIdIndexLib.sol` - ID/index set helpers. Its legacy global `mainId` uniqueness helpers are retained for compatibility only; current launch metadata readiness is checked by matrix-aware validation in the collection contracts.
- `BiggiMetaRedeemLib.sol` - Shared metadata URI builders for ticket, main, reward, and character files.
- `BiggiNamesLib.sol` - Core name formatting helpers.
- `BiggiNamesLib2.sol` - Public branch name formatting helpers.
- `BiggiPriceMathLib.sol` - Ticket and mint price math helpers.
- `BiggiSwapLib.sol` - Retained compatibility swap helper; not imported by active core contracts.
