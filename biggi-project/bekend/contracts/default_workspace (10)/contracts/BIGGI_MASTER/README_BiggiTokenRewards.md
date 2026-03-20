# BiggiTokenRewards

Role: weekly BIGGI rewards for eligible collections.

Preserved:
- existing unit reward math
- per-token weekly claim tracking
- payout from balance then mint up to cap

Updated:
- optional `registry` source-of-truth for collection eligibility
- if registry is set, validation is no longer based on local allowlist/main-only assumptions

Logic change: **MINOR LOGIC CHANGE**
- claim validation can now be registry-driven
- reward math itself was preserved
