# Audit Notes - ModeratorCenter

## Security invariants
- Referral uniqueness policy behaves as configured
- Distribution pool cannot exceed actual balance
- Milestone payouts cannot be replayed

## Required test coverage
- Happy path with production-like parameters.
- Revert path for unauthorized caller or invalid config.
- Pause/emergency behavior where applicable.
- Cross-contract integration smoke with downstream dependencies.

## Runtime monitoring checklist
- Track critical events and balances via readers and indexer.
- Alert on paused states, failed upkeep runs, and threshold breaches.
- Alert on ownership/keeper changes.

## Status (2026-08-25)
- Deployed bytecode and verified source match the canonical `TOKENOMICMAINNET/ModeratorCenter.sol`.
- Deployment exists on Polygon mainnet, but the moderator program is inactive:
  all ten slots are disabled, no reporter is configured, milestones are zero,
  and no allocation or activity has been recorded.
- Production activation is blocked by settlement, sale-attribution, milestone,
  payout, admin-control, and frontend integration findings.
- Canonical detailed review:
  `../../MODERATOR_CENTER_AUDIT_2026-08-25_CS.md`.
- Do not describe the module as live or production-ready before a hardened V2
  is deployed, configured, tested, and ownership is transferred to the
  approved production authority.

## V2 deployment update (2026-08-26)
- `ModeratorCenterV2` is deployed and source-verified at
  `0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8`.
- `BiggiDripLMToModeratorV2` is deployed and source-verified at
  `0x1d2B3d3224dE553ff3138caeA45d162c62305d1A`.
- Both contracts are paused and owned by
  `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2`.
- The live tokenomics branch was not rewired. V2 is not active and still needs
  moderator slot configuration plus the final production activation gate.
- Canonical status: `../../MODERATOR_V2_MAINNET_STATUS_2026-08-26_CS.md`.
