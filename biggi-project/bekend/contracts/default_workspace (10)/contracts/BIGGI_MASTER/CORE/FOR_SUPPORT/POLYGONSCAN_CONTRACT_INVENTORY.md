# PolygonScan Contract Inventory

Live audit date: 2026-08-26

Canonical machine-readable inventory:

```text
EVIDENCE/deployment-manifest-polygon.json
```

Summary:

- Current canonical contracts: `60/60` source verified
- Deprecated historical contracts: `3/3` source verified
- All BIGGI-owned contracts with bytecode: `63/63` source verified
- Unverified contracts with bytecode: `0`
- PolygonScan pages reporting `Contract: Verified`: `63/63`
- Existing public name tags: `10/63`
- Missing public name tags: `53/63`

The JSON evidence file is the authoritative inventory for PolygonScan support because it includes every key, address, deployer, deployment transaction hash, source-verification flag, contract name, and compiler version.

Important addresses:

| Key | Contract | Address |
| --- | --- | --- |
| `MAIN` | `BiggiEyesMain` | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` |
| `MAIN2` | `BiggiEyesMain2` | `0xe56cC0657A89daf10994204eD745985a61b0E36F` |
| `TICKET_HUB` | `BiggiTicketHub` | `0x7b7e561173f498C8274b821090Da64E8ee653f6A` |
| `DISTRIBUTOR` | `BiggiMultiCollectionDistributor` | `0xCE892698159D8D799D5eF7f0dF0111487511fD22` |
| `BIGGI_TOKEN` | `BiggiToken` | `0xD73152845Bc5a9b8253ea0100BB10388CC5c0EeD` |
| `TOKEN_REWARDS` | `BiggiTokenRewards` | `0xA455775BBe0BC863f644516147b95Ef5103b29FA` |
| `TOKEN_REWARDS_EMISSION_CONTROLLER` | `BiggiTokenRewardsEmissionController` | `0xA7B71DFEBF89481b37d803dD0765E3612f29Ffb9` |
| `BUYBACK_AGENT` | `BiggiBuybackAgent` | `0x5A77E90c467576C82B8d0E74eD112B829C625BB4` |
| `BUYBACK_UPKEEP_PROXY` | `BiggiBuybackUpkeepProxy` | `0x3C260f987d1aD7cA3dC8D61a3B731b2068c38875` |
| `LIQUIDITY_KEEPER_PROXY` | `BiggiLiquidityKeeperProxy` | `0x4fC6EaD8CC6451e1A5EA7Ceaf6a072e18f91F04c` |
| `DEX_RESERVE_GUARD` | `BiggiDexReserveGuard` | `0x350370c248495758b80Ea1C564Df1290cA76588B` |
| `SUPPLY_CONTROLLER` | `BiggiSupplyController` | `0x810ba27C98aAB09737e3988a3C1b10D6CadaB8E8` |
| `CRE_AUTOMATION_RECEIVER` | `BiggiCREAutomationReceiver` | `0xF1a21E04DA73580eD2D1311412e3639C40D47Fe6` |

Chapter contracts:

| Key | Contract | Address |
| --- | --- | --- |
| `CHAPTER_2_MAIN` | `BiggiEyesMain` | `0x5Bec5aeE4Ff8b1B5e7CBddcEEC61555354002036` |
| `CHAPTER_2_MAIN2` | `BiggiEyesMain2` | `0x7EaB23497085cfF00Cb2E9809b2Af0e717187356` |
| `CHAPTER_3_MAIN` | `BiggiEyesMain` | `0x72e6DE66f340E0243DAF45917E7Ce8057Faeedc2` |
| `CHAPTER_3_MAIN2` | `BiggiEyesMain2` | `0xda6A6f45053796d0f5edB965fe3FA47B9a35460c` |
| `CHAPTER_4_MAIN` | `BiggiEyesMain` | `0x8E862D9071120D69517D3F7Db0c101175E911115` |
| `CHAPTER_4_MAIN2` | `BiggiEyesMain2` | `0xecE7D61AB3FB2229C39B48380D704183532fE960` |
| `CHAPTER_5_MAIN` | `BiggiEyesMain` | `0xCA09F0b1f06AD3aA2302ED40Cb12013B84b52B38` |
| `CHAPTER_5_MAIN2` | `BiggiEyesMain2` | `0x99f049279BC545469F989d8f06CD915ef4B6f1d4` |

For a complete row-by-row list, use `EVIDENCE/deployment-manifest-polygon.json`.

## Verified Staged Contracts

These contracts are included in the current 60-contract manifest. They are
source-verified and paused, but are not connected to the live tokenomics branch
yet:

| Key | Contract | Address | Deploy block |
| --- | --- | --- | ---: |
| `MODERATOR_CENTER_V2` | `ModeratorCenterV2` | `0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8` | `92715374` |
| `DRIP_LM_V2` | `BiggiDripLMToModeratorV2` | `0x1d2B3d3224dE553ff3138caeA45d162c62305d1A` | `92716040` |

Deployment evidence:

```text
biggi-project/bekend/reports/moderator-v2-deployment-polygon.json
```

## Deprecated Historical Contracts

These replaced contracts remain immutable Polygon mainnet history. They are
source verified but must be clearly tagged as deprecated, not presented as
current protocol endpoints:

| Key | Contract | Address |
| --- | --- | --- |
| `OLD_TICKET_HUB` | `BiggiTicketHub` | `0xe6D742D7dC66fa63434E6794C69798A5272E9873` |
| `OLD_COLLECTION_REWARDS` | `BiggiCollectionRewards` | `0x5D1273070C9133381C570009768621762F024fB8` |
| `OLD_MAIN_READER` | `BiggiMainReader` | `0x4937cdCf1668255cB46c78E19547Ea96c94391EF` |

The stale `MOCK_QUOTE` value was removed from all current Polygon address/env
manifests after RPC confirmed that the recorded address has no bytecode. The
active quote token remains canonical WPOL.

## Public Name Tags

Source verification is complete. Public PolygonScan name tags are a separate,
manually reviewed explorer state. The live per-address audit and prepared bulk
submission are in:

```text
EVIDENCE/polygonscan-public-tags.json
POLYGONSCAN_PUBLIC_NAME_TAG_SUBMISSION.md
```

The BIGGI/WPOL pair is factory-created and is outside the BIGGI-owned contract
manifest. It already has the public tag `BiggiEyes: POL Liquidity Pair`.
