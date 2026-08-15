# BIGGI Core Contracts

This folder contains the core collection, ticket, registry, rewards, VRF, reader, library, and distribution contracts moved out of the `BIGGI_MASTER` root for a cleaner layout.

Current deployment status: live on Polygon mainnet as of 2026-06-16. Address references are canonical when they match `addresses.master.json`, phase-specific Polygon manifests, or `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.

Supporting dependencies:
- `CORE_LIBRARY/` for shared BIGGI core libraries
- `CORE_READERS/` for read-only core aggregators
- `../chainlink` for VRF dependency shims
- `../TOKENOMICMAINNET` for tokenomics and operational contracts

## Contracts
- `BiggiMain.sol` - Primary VRF collection contract.
- `BiggiMain2.sol` - Public collection branch contract.
- `BiggiTicketHub.sol` - Ticket lifecycle and minting hub.
- `BiggiSeriesRegistry.sol` - Series/chapter/collection registry.
- `BiggiChapterController.sol` - Chapter lifecycle control plane.
- `BiggiCompute.sol` - Small compute/helper contract.
- `BiggiCollectionRewards.sol` - Collection rewards accounting.
- `BiggiTokenRewards.sol` - Token rewards accounting.
- `BiggiNftRewards.sol` - NFT rewards contract.
- `BiggiVrfRouter.sol` - VRF router for collection and rewards randomness.
- `BiggiMultiCollectionDistributor.sol` - Multi-collection distribution router.

## Readmes
- `README_BiggiChapterController.md`
- `README_BiggiCollectionRewards.md`
- `README_BiggiMain2.md`
- `README_BiggiMultiCollectionDistributor.md`
- `README_BiggiSeriesRegistry.md`
- `README_BiggiTicketHub.md`
- `README_BiggiTokenRewards.md`

## ABI Package
- `CORE_ABI/` contains the frozen ABI package for the core contracts.

## Mainnet Prep Dossiers
- `MAINNET_CONTRACT_DOSSIERS/` contains the core mainnet preparation dossiers, ABI snapshots, audit notes, and source path records. These dossiers now include canonical deployed Polygon mainnet addresses.

## Core Docs
- `CORE_ARCHITECTURE_CS.md` describes how the full core stack works, how contracts are linked, and how the system scales.
- `CORE_DEPLOY_ORDER_CS.md` defines the recommended deploy order for minimal, chapter, and full core launches.
- `CORE_RUNBOOK_CS.md` provides the post-deploy wiring and smoke-test sequence.
- `CORE_MAINNET_REAL_DATA.md` records the current deployment status, manifest reference data, local gate data, and remaining mainnet preparation gaps.
- `CORE_DEEP_AUDIT_2026-06-07_CS.md` records the current deep CORE deploy-readiness audit result.

## Core Library
- `CORE_LIBRARY/BiggiBpsLib.sol`
- `CORE_LIBRARY/BiggiCapsLib.sol`
- `CORE_LIBRARY/BiggiCollectionEligibilityLib.sol`
- `CORE_LIBRARY/BiggiErrorsLib.sol`
- `CORE_LIBRARY/BiggiIdIndexLib.sol`
- `CORE_LIBRARY/BiggiMetaRedeemLib.sol`
- `CORE_LIBRARY/BiggiNamesLib.sol`
- `CORE_LIBRARY/BiggiNamesLib2.sol`
- `CORE_LIBRARY/BiggiPriceMathLib.sol`
- `CORE_LIBRARY/BiggiSwapLib.sol`

## Core Readers
- `CORE_READERS/BiggiChapterSeriesReader.sol`
- `CORE_READERS/BiggiMainReader.sol`
- `CORE_READERS/BiggiMultiCollectionDistributorReaderV2.sol`
- `CORE_READERS/BiggiNftRewardsReader.sol`
