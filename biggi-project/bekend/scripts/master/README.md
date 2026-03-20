# BIGGI_MASTER scripts

## Deploy

Run from `biggi-project/bekend`:

```bash
npm run deploy:master
```

or:

```bash
npx hardhat run --config hardhat.biggi-master.cjs scripts/master/deployMasterStack.js --network amoy
```

Polygon mainnet:

```bash
npm run deploy:master:polygon
```

Mainnet env template:

```bash
scripts/master/.env.polygon.example
```

### Important env

- `SALE_CAP`, `MARKETING_CAP` (`sale + marketing = 550`)
- `VRF_COORDINATOR`, `VRF_KEY_HASH`, `VRF_SUB_ID` (optional, for real VRF router deploy)
- `VRF_ROUTER` (optional existing router address; script will wire MAIN/MAIN2 approvals when possible)
- `NFT_REWARDS` (optional existing `BiggiNFTRewards` address)
- `PAIR`, `QUOTE_TOKEN` (required on non-local unless `DEPLOY_MOCK_PAIR=1`)
- `STRICT_NOTIFY_CALLERS` (`1` default; set `0` to keep reserve notify hook permissive)
- `CIRCUIT_BREAKER_ENABLED` (`1` default)
- `CB_DEX_CRITICAL_FLOOR` (default `500` BIGGI)
- `CB_REWARDS_CRITICAL_FLOOR` (default `500` BIGGI)
- `MARKETING_SUPPORT` (optional; if omitted, initial 200M marketing support mints to `TREASURY`)
- optional branch addresses: `DRIP_LM`, `BUYBACK_AGENT`, `BUYBACK_ROUTER`, `COMMUNITY_CENTER`, `POLICY`, `LIQUIDITY_MANAGER`, `LIQUIDITY_VAULT`, `LIQUIDITY_ORCHESTRATOR`, `LIQUIDITY_KEEPER_PROXY`, `LIQUIDITY_AUTOMATION`, `DRIP_KEEPER_PROXY`, `BUYBACK_UPKEEP_PROXY`, `MULTI_COLLECTION_READER`, `CHAPTER_SERIES_READER`, `MULTICALL`, `ROUTER`, `FACTORY`, `WETH`
- `DEPLOY_LIQUIDITY_BRANCH` (`1|0`, default `1` on local networks)
- `DEPLOY_BUYBACK_BRANCH` (`1|0`, default `1` on local networks)
- `DEPLOY_BUYBACK_AGENT` (`1|0`, default follows `DEPLOY_BUYBACK_BRANCH`)
- `DEPLOY_BUYBACK_ROUTER` (`1|0`, default local `1` when buyback agent is deployed; deploys `MockBuybackRouter` only on local networks)
- `MOCK_BUYBACK_ROUTER_SEED_BIGGI` (optional BIGGI amount for local mock buyback router funding, default `0`)
- `DEPLOY_COMMUNITY_CENTER` (`1|0`, default follows `DEPLOY_BUYBACK_BRANCH`)
- `DEPLOY_POLICY` (`1|0`, default follows `DEPLOY_BUYBACK_BRANCH`)
- `DEPLOY_DRIP_KEEPER_PROXY` (`1|0`, default `1` on local networks)
- `DEPLOY_BUYBACK_UPKEEP_PROXY` (`1|0`, default `1` on local networks)
- `DEPLOY_MULTI_COLLECTION_READER` (`1|0`, default `1` on local networks)
- `DEPLOY_CHAPTER_SERIES_READER` (`1|0`, default `1` on local networks)
- `DEPLOY_MULTICALL` (`1|0`, default `1` on local networks)
- `DEPLOY_NFT_REWARDS` (`1|0`, default `1` on local networks)
- `ALLOW_DISTRIBUTOR_RECIPIENT_FALLBACK` (`1|0`, default `1`; on local networks falls back missing `BUYBACK_AGENT/COMMUNITY_CENTER` to `TREASURY`)
- liquidity defaults (optional overrides):
  - `LIQ_TOKEN_PCT`, `LIQ_SLIPPAGE_BPS`, `LIQ_DEADLINE_SEC`
  - `LIQ_ORCH_MIN_POL_PER_TX`, `LIQ_ORCH_MAX_POL_PER_TX`, `LIQ_ORCH_MIN_DEX_REFILL_BIGGI`, `LIQ_ORCH_COOLDOWN_SEC`, `LIQ_ORCH_DAILY_QUOTA_POL`
  - `LIQ_KEEPER_MODE`, `LIQ_KEEPER_FIXED_POL`, `LIQ_KEEPER_PERCENT_BPS`, `LIQ_KEEPER_MIN_INTERVAL_SEC`, `LIQ_KEEPER_MIN_RESERVE_POL`, `LIQ_KEEPER_MAX_PER_TX`, `LIQ_KEEPER_MIN_DEX_REFILL_BIGGI`
  - `LIQ_AUTO_MIN_POL_WEI`, `LIQ_AUTO_MAX_POL_WEI`, `LIQ_AUTO_MIN_INTERVAL_SEC`
  - `BUYBACK_MIN_NATIVE_WEI`

If env values are missing, deploy script can auto-load hints from local `addresses.json` (testnet snapshot).
If hinted addresses have no deployed code on target network, script ignores them and auto-deploys required parts (local mode).

Deploy writes `addresses.master.json`.
It also includes `BUYBACK_AGENT_EFFECTIVE` and `COMMUNITY_CENTER_EFFECTIVE` for the real distributor recipients used after fallback/validation.
When available, `BUYBACK_ROUTER` and `MOCK_BUYBACK_ROUTER` are also exported.

## Check status

```bash
npm run check:master
```

This reads `addresses.master.json` and prints key wiring/health signals for:

- chapter scaling contracts
- VRF router wiring + approvals
- token/drip/tokenRewards
- nftRewards wiring
- treasury + buyback + policy
- collection rewards + multi-collection distributor + optional community/moderator
- supply controller + dex reserve guard
- liquidity manager/vault/orchestrator/keeper/automation
- drip keeper + buyback upkeep proxies
- master config + optional multi-collection reader + chapter/series reader + multicall

For non-default network:

```bash
npx hardhat run --config hardhat.biggi-master.cjs scripts/master/checkMasterStatus.js --network amoy
```

Polygon mainnet:

```bash
npm run check:master:polygon
```

Note: default `hardhat` runs are ephemeral per command. For meaningful `check` output, use a persistent network/session where deployed addresses exist.

Local persistent flow:

```bash
npx hardhat node --config hardhat.biggi-master.cjs
```

Then in another terminal:

```bash
npx hardhat run --config hardhat.biggi-master.cjs scripts/master/deployMasterStack.js --network localhost
npx hardhat run --config hardhat.biggi-master.cjs scripts/master/checkMasterStatus.js --network localhost
```

You can also use npm aliases:

```bash
npm run node:master
npm run deploy:master:local
npm run check:master:local
```

## Strict consistency mode

Status checker supports strict mismatch detection via env flags.

```bash
# strict mode (fails with non-zero exit code on mismatch)
npm run check:master:strict

# strict + require code for all configured addresses
CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 npx hardhat run --config hardhat.biggi-master.cjs scripts/master/checkMasterStatus.js --network localhost

# use deployed addresses file + strict
CHECK_STRICT=1 MASTER_ADDRESSES_FILE=./addresses.json npx hardhat run --config hardhat.biggi-master.cjs scripts/master/checkMasterStatus.js --network amoy
```

Optional env:

- `CHECK_STRICT=1`
- `CHECK_REQUIRE_CODE=1`
- `MASTER_ADDRESSES_FILE=./addresses.json`
- `EXPECT_STRICT_NOTIFY=1|0` (default follows strict mode)

## Test without deployment

Yes: local smoke tests run fully without chain deployment.

```bash
npm run test:master
```

For mainnet-like simulation you can use fork tests:

```bash
npm run test:master:fork
```

Fork notes:

- requires archive-capable RPC (`FORK_URL` or `.env` `AMOY_RPC_URL`)
- if provider rate-limits, pin block for cache stability:
  - `FORK_BLOCK_NUMBER=<block>`
