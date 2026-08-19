# Pending Mainnet Activation Runbook

Datum: 2026-08-19

Tento runbook je priprava. Nejde o potvrzeni, ze transakce byly spustene.

## 1. Initial Liquidity

Plan:

- `8,000,000 BIGGI`
- `5,000 POL`
- LP recipient: `0xFe234394845B601B2c671c0dD631fA6290c02bb9` (`LIQUIDITY_VAULT`)
- `TRANSFER_FROM_RESERVE=1`
- `LIQ_POST_SEED_SYNC_POL=1`

Dry-run:

```powershell
$env:DEPLOYER='0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2'
$env:LIQ_TOKEN_AMOUNT='8000000'
$env:LIQ_NATIVE_AMOUNT='5000'
$env:LIQ_LP_RECIPIENT='0xFe234394845B601B2c671c0dD631fA6290c02bb9'
$env:TRANSFER_FROM_RESERVE='1'
$env:ALLOW_UNSYNCED_VAULT_LP='1'
npm run prepare:initial-liquidity:polygon
```

Current dry-run blocker:

- Owner wallet does not have enough POL for `5000 POL + 1 POL + gas`.

Execution must not be run until the owner wallet has enough POL and the irreversible flag is set intentionally:

```powershell
$env:EXECUTE_INITIAL_LIQUIDITY='1'
$env:I_UNDERSTAND_INITIAL_LIQUIDITY_IS_IRREVERSIBLE='1'
npm run prepare:initial-liquidity:polygon
```

## 2. Post-Liquidity Checks

```powershell
npm run preflight:launch:polygon
npm run check:master:core:polygon
```

The pair must have non-zero reserves and non-zero LP supply.

## 3. Tokenomics Activation

DripKeeper must remain paused. Drip is triggered by BuybackAgent through DripLM.

Dry-run:

```powershell
npm run activate:tokenomics:polygon
```

Execution, only after liquidity passes:

```powershell
$env:EXECUTE_TOKENOMICS_ACTIVATION='1'
$env:I_UNDERSTAND_KEEPERS_GO_LIVE='1'
$env:ENABLE_LIQUIDITY_ORCHESTRATOR='1'
$env:ENABLE_LIQUIDITY_KEEPER='1'
$env:ENABLE_BUYBACK_UPKEEP='1'
$env:ENABLE_AUTO_BUYBACK='1'
$env:ENABLE_DRIP_KEEPER='0'
npm run activate:tokenomics:polygon
```

## 4. CRE

CRE is still blocked by account access:

- `cre whoami` reports `Deploy Access: Not enabled`.

Until Chainlink enables deploy access, do not run production deploy/activate.

After deploy access is enabled:

```powershell
cre workflow list --target production-settings
cre workflow simulate .\my-workflow --target test-settings --trigger-index 0 --non-interactive
```

Deployment/activation must wait for explicit confirmation and for workflow ID/owner values to be known.

Required receiver steps after production workflow identity is known:

- set expected workflow ID
- set expected workflow owner
- allowlist five target/selector pairs
- set receiver keeper/allowed-caller roles
- unpause receiver last
