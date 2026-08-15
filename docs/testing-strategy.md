# Testing Strategy (practical)

Goal: catch integration regressions (router reverts, allowance edges, low
liquidity) that unit tests miss.

## 1) Integration tests (multi-contract)
- Scenario: mint -> split -> buyback -> treasury -> reserve -> LM/vault.
- Validate balances, caps, and access control at each hop.
- Use a live Polygon mainnet RPC with read-only checks when possible.

## 2) Fork tests (optional but high value)
- Run against a forked Polygon mainnet when `FORK_URL` is provided.
- Verify router/factory/pair behavior matches production.

## 3) Fuzz / property tests
- BPS splits always sum <= 10000.
- caps never exceeded.
- weekly claim: no double-claim.

## 4) Static analysis
- Slither (or equivalent) in CI for critical contracts.
- Keep false-positives documented in a allowlist.

## 5) Minimal smoke tests (added)
- `biggi-project/bekend/test/integration/rewards-readers.test.js`
  validates reader contracts and invariant sanity checks using RPC.

## 6) How to run
```bash
cd biggi-project/bekend
POLYGON_RPC_URL="https://polygon.drpc.org" npm test
```

