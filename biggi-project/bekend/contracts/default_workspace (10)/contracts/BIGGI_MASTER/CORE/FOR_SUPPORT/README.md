# BIGGI Support Package

Date: 2026-08-25

Purpose: one place for external support conversations about BIGGI mainnet source verification and Chainlink CRE migration.

This folder intentionally does not contain secrets, private keys, API keys, wallet seed phrases, `.env` files, signed legal documents, or the signed MNDA. The MNDA status can be stated as: `MNDA signed; available through approved private channel if requested`.

## Files

- `CHAINLINK_CRE_SUPPORT_BRIEF.md` - meeting-ready CRE summary for Chainlink support.
- `CHAINLINK_CRE_TECHNICAL_SPEC.md` - technical workflow and receiver details.
- `CHAINLINK_CRE_MEETING_CHECKLIST_CS.md` - short Czech checklist for the call.
- `POLYGONSCAN_SOURCE_VERIFICATION.md` - exact verification environment and commands.
- `POLYGONSCAN_CONTRACT_INVENTORY.md` - source-verification inventory summary and canonical evidence file.
- `PRE_LIQUIDITY_AUTOMATION_READINESS_2026-08-19.md` - pre-liquidity readiness and activation order.
- `CRE_STATUS_SNAPSHOT_2026-08-25.json` - current machine-readable support snapshot.
- `CRE_STATUS_SNAPSHOT_2026-08-19.json` - historical machine-readable support snapshot.
- `EVIDENCE/` - copied public reports generated from the repo tooling.

## Current CRE Status

- CRE CLI: `v1.30.0`
- Bun: `1.3.14`
- CRE account organization ID: `org_d09xtsv4XAgGOXMi`
- CRE organization name: `My Org`
- Deploy access: `Not enabled`
- Linked workflow owners: none found
- Production workflows: none found
- Workflow deployment registry: `private`
- Receiver is deployed on Polygon mainnet but intentionally paused and not allowlisted yet.
- Safe simulation on 2026-08-25: `needed=1`, `submitted=0`, `failed=0`, `dryRun=true`.
- Polygon-fork CRE automation rehearsal: 5/5 branches, 6/6 adversarial checks and 5/5 duplicate/stale-report checks passed; no mainnet transaction was sent.
- Current launch preflight: `okForDeployOnly=true`, `okForPublicLaunch=false`, 9 blockers and 2 expected warnings.
- Mainnet `BUYBACK_UPKEEP_PROXY.minNativeThresholdWei` is incorrectly `1 wei`; the activation tooling now requires a non-dust value and schedules the canonical `0.5 POL` threshold before unpausing the proxy.
- `cre account access --non-interactive` unexpectedly reported a submitted request without collecting a description; Chainlink should confirm which request is active.

## Current Initial Liquidity Status

- Requested seed: `8,000,000 BIGGI + 5,000 POL`.
- Owner wallet balance observed: `1.824440220558510091 POL`.
- Deployment wallet balance observed: `1.387342241466426688 POL`.
- BIGGI/WPOL pair reserves and LP supply are still zero.
- The dry-run is blocked only by insufficient native POL on the token-owner wallet.
- The 2026-08-25 Polygon fork rehearsal passed all five seed and Vault-accounting checks without sending a mainnet transaction.

## Current PolygonScan Status

- Network: Polygon mainnet, chain ID `137`
- Deployment manifest summary: `58` contracts, `58` with bytecode, `58` source verified, `0` unverified.
- Canonical source-evidence copy: `EVIDENCE/deployment-manifest-polygon.json`

## Important Operational Note

Do not activate CRE, unpause the receiver, or open keeper allowlists until the Chainlink support questions are resolved and the production workflow ID/owner are known.
