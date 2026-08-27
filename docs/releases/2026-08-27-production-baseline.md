# BIGGI production baseline - 2026-08-27

This baseline records the tested Polygon mainnet application, contract sources,
deployment evidence, and operational configuration in one Git revision.

## Release identity

- Source branch: `release/netlify-responsive-20260824`
- Release tag: `production-baseline-2026-08-27`
- Production site: <https://biggieyes.com>
- Netlify site ID: `dac321e9-74ae-4e07-b765-33be002cc7e8`
- Last verified predecessor deploy: `6a8f7e44f97d0726f6a37411`
- Required Node runtime: `>=20.19` (CI uses Node 22)

The annotated Git tag records the Netlify deploy ID produced from this exact
baseline after CI verification.

## Verification gates

- Frontend lint gate, including JSX
- TypeScript check
- 119 Vitest tests
- ABI and backend/frontend address consistency checks
- Vite production build
- Playwright desktop and 390 px mobile runtime smoke
- BIGGI_MASTER compilation and 102 Hardhat tests
- Current-tree and pending-file secret scan
- npm high/critical audit for root, backend, and public mirror lockfiles

## Security status

The root and public mirror lockfiles have no npm advisories. The Hardhat ethers
v5 development stack has one upstream low-severity `elliptic` advisory with no
patched compatible release. Resolving it requires a separately tested major
ethers/Hardhat migration; no forced upgrade is included in this baseline.

Local `.env` files, Netlify state, screenshots, build output, and generated
Hardhat artifacts are excluded from Git. Public addresses and empty environment
templates remain tracked for reproducibility.

## Scope note

This release does not execute any Polygon transaction, change contract roles,
activate CRE, or add liquidity. It only records and verifies the repository and
the web deployment.
