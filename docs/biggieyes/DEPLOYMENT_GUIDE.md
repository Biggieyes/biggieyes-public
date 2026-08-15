# Deployment Guide

## Scope

This guide describes how to deploy and wire the BIGGIEYES protocol stack as represented in this repository. The current public configuration targets Polygon mainnet.

## Prerequisites

### Tooling

- Node.js `>= 18.18`
- npm
- Hardhat environment under `biggi-project/bekend`
- funded deployer account
- Chainlink VRF subscription on the target chain

### Environment Inputs

You will need:

- target chain RPC URLs
- deployer private key or signer configuration
- Chainlink coordinator, key hash, and subscription ID
- DEX router, factory, WETH/WPOL, and pair addresses
- production frontend env values

## Recommended Deployment Order

### Phase 1. Core Economic Contracts

Deploy:

1. `BiggiToken`
2. `BiggiReserveV4`
3. `BiggiTreasury`
4. `BiggiTokenRewards`
5. `BiggiDripDistributor`
6. `BiggiBuybackAgent`
7. `LiquidityVault`
8. `BiggiLiquidityManager`
9. `BiggiCommunityCenter`
10. `BiggiCollectionRewards`
11. `MultiCollectionDistributor`

### Phase 2. NFT And Randomness Contracts

Deploy:

1. `BiggiVRFRouter`
2. `BiggiEyesMain`
3. `BiggiEyesMain2`

### Phase 3. Operational And Read Contracts

Deploy:

1. reader contracts
2. keeper proxies
3. policy contract
4. master tokenomics config registry

## Wiring Sequence

### 1. Token And Treasury Wiring

Use the equivalent of:

- `biggi-project/bekend/scripts/setupTokenAndTreasury.js`

Required links:

- `BiggiToken.setReserve(reserve)`
- `BiggiToken.setDripDistributor(dripDistributor)`
- `BiggiToken.setTokenRewards(tokenRewards)`
- `BiggiTreasury.setReserve(reserve)`
- `BiggiTreasury.setDripDistributor(dripDistributor)`
- `BiggiTreasury.setTokenRewards(tokenRewards)`
- `BiggiTreasury.setDistributor(distributor)`
- `BiggiTreasury.setBuybackAgent(buybackAgent)`

### 2. Reserve Wiring

Use:

- `biggi-project/bekend/scripts/setupReserve.js`

Required links:

- `Reserve.setLiquidityManager(liquidityManager)`
- `Reserve.setDistributor(distributor)`

### 3. Distributor Wiring

Use:

- `biggi-project/bekend/scripts/setupMultiCollectionDistributor.js`
- `biggi-project/bekend/scripts/whitelistCollection.js`

Required links:

- `Distributor.setCollectionRewards(collectionRewards)`
- `Distributor.setReserve(reserve)`
- `Distributor.setBuybackAgent(buybackAgent)`
- `Distributor.setTreasury(treasury)`
- `Distributor.setCommunityCenter(communityCenter)`
- whitelist `BiggiEyesMain`
- whitelist `BiggiEyesMain2`

### 4. Liquidity Branch Wiring

Use:

- `biggi-project/bekend/scripts/wireLiquidityBranch.js`
- `biggi-project/bekend/scripts/updateLiquidityBranch.js`

Required links:

- `Reserve.setLiquidityManager(liquidityManager)`
- `LiquidityManager.setReserve(reserve)`
- `LiquidityManager.setLiquidityVault(liquidityVault)`
- `LiquidityVault.setLiquidityManager(liquidityManager)`
- whitelist the LP pair in `LiquidityVault`

### 5. Drip Branch Wiring

Use:

- `biggi-project/bekend/scripts/updateDripBranch.js`

Required links:

- `DripDistributor.setDripLM(dripLM)`
- `DripDistributor.setTreasury(treasury)`
- `DripLiquidityManager.setReserve(reserve)`
- `DripLiquidityManager.setDripDistributor(dripDistributor)`
- `DripLiquidityManager.setBuybackAgent(buybackAgent)`
- `DripLiquidityManager.setModeratorCenter(...)`

### 6. Buyback Wiring

Use:

- `biggi-project/bekend/scripts/deployBuybackAgent.js`
- `biggi-project/bekend/scripts/updateBuybackAgent.js`

Required links:

- `BuybackAgent.setTreasury(treasury)`
- `BuybackAgent.setPolicy(policy)`
- `BuybackAgent.setDripLM(dripLM)`
- `BuybackAgent.setRouter(router)`
- `BuybackAgent.setKeeper(keeper)`

### 7. VRF Wiring

Required links:

- `VRFRouter.setMain(main)`
- `VRFRouter.setVrfParams(...)`
- `BiggiEyesMain.setModules(compute, vrfRouter)`

### 8. Collection Wiring

Required links:

- `BiggiEyesMain.setDistributor(distributor)`
- `BiggiEyesMain.setBiggiToken(biggi)`
- `BiggiEyesMain.setReserveAddress(reserve)`
- `BiggiEyesMain2.setDistributor(distributor)`
- `BiggiEyesMain2.setPriceProvider(main)`
- `BiggiEyesMain2.setBiggiToken(biggi)`
- `BiggiEyesMain2.setReserveAddress(reserve)`

### 9. Metadata Seeding

Before public minting, seed NFT index metadata:

- `BiggiEyesMain.batchSetNFTBackgroundAndBlock(...)`
- `BiggiEyesMain2.batchSetNFTBackgroundAndBlock(...)`
- set URIs for ticket, block, and reward metadata bases

### 10. Initial Distribution

Once reserve, drip distributor, and token rewards are wired:

- call `BiggiToken.initialDistribute()`

This mints the strategic allocations and notifies the drip distributor.

## Address Registry Publication

After deployment:

1. update `biggi-project/bekend/addresses.json`
2. update `src/shared/utils/addresses.js`
3. confirm explorer verification for all public contracts
4. publish a deployment manifest with tx hashes and constructor parameters

## Frontend Environment Setup

Populate `.env.local` or deployment env vars with:

- `VITE_*` contract addresses
- RPC URLs
- WalletConnect project ID
- optional Sentry DSN
- optional archive RPC URLs

The current `.env.example` already includes Polygon mainnet VRF and main collection values.

## Verification Checklist

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run check:abis`
- `npm run check:contracts`
- `npm run check:rpc`

## Post-Deploy Operational Checklist

1. verify contract ownership points to multisig
2. verify VRF subscription funding and consumer registration
3. verify all collection and recipient addresses inside `Distributor`
4. verify keeper and policy wiring
5. verify LP pair whitelist and vault sync
6. verify frontend reads against the new address registry
7. verify pending reward and buyback dashboards

## Recommended Production Controls

- use multisig ownership
- store deployment configs in version-controlled manifests
- document slippage, cooldown, quota, and reward parameters per release
- monitor VRF lag, reserve balances, and automation health from day one
