# PolygonScan source verification - BiggiNFTRewardsV2

Tento dokument platí až po vytvoření
`biggi-project/bekend/reports/nft-rewards-v2-deployment-polygon.json`.

## Contracts

### BiggiNFTRewardsV2

- Fully qualified source:
  `contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiNftRewardsV2.sol:BiggiNFTRewardsV2`
- Solidity: `0.8.24`
- Optimizer: enabled, `200` runs
- `viaIR: true`
- Constructor arguments:
  1. `finalOwner` from the deployment report
  2. `dependencies.vrfRouter` from the deployment report

### BiggiNftRewardsReader

- Fully qualified source:
  `contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_READERS/BiggiNftRewardsReader.sol:BiggiNftRewardsReader`
- Constructor argument: `nftRewardsV2` from the deployment report

## Automated verification

From repository root:

```powershell
npm --prefix biggi-project/bekend run verify:nft-rewards-v2:polygon
```

The script reads exact addresses and constructor arguments from the deployment
report. Do not copy predicted addresses from a dry-run report into PolygonScan.
