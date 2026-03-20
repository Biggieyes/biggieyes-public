# BiggiDexReserveGuard
Decision layer for DEX reserve depletion protection. Reads pair reserves and triggers dex refill through SupplyController. Do not add direct mint authority here. Verify pair/token alignment, cooldowns, baseline snapshot, and keeper wiring before edits.
