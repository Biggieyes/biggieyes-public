# Moderator V2 mainnet readiness - 2026-09-09

Status: NOT ACTIVATED. Slot configuration is awaiting user input; production
activation also requires funded DEX liquidity. No mainnet transaction was sent.

## Read-only mainnet evidence

- Checked at `2026-09-09T00:04:54.404Z`, Polygon mainnet chain ID `137`, block
  `93471504`. Contract reads were pinned to this block through Multicall3.
- Moderator V2: `0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8`.
- Drip V2: `0x1d2B3d3224dE553ff3138caeA45d162c62305d1A`.
- Moderator, Drip, DripDistributor and BuybackAgent have the expected owner:
  `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2`.
- Both V2 contracts remain paused. Moderator `operationallyReady()` is false;
  all ten slots are disabled with zero payout addresses and referral hashes.
- Drip `wiringReady()` is true. Its Moderator, distributor, reserve, buyback and
  router match the deployment and address manifests. Moderator's allocator is
  Drip V2 and its TicketHub is the production TicketHub.
- Five chapters are registered with paid ranges `51-550`, `601-1100`,
  `1151-1650`, `1701-2200`, `2251-2750`. Each records a 500 paid / 50 marketing cap.
- Moderator coefficients remain `100 / 30 / 10`, global uniqueness is enabled,
  and milestone configuration is locked.
- Drip parameters remain sell `70%`, reserve/moderator split `5000 / 5000` bps,
  slippage `200` bps and deadline `600` seconds.
- Moderator liabilities and both Drip pending native balances are zero.
- DripDistributor's `dripLM` and `tokensPerMintOperator`, and BuybackAgent's
  `dripLM`, still point to legacy `0xE258843bca54803a366413571b3B4d6a28eAF2eC`.
- The configured QuickSwap factory returns the expected BIGGI/WPOL pair
  `0x59C7B17B3ACD48979B25215a0c477dF6FFFF3e90`, but its reserves are `0 / 0`.
  Router WETH and both pair tokens match the manifest.
- Dev wallet balance is approximately `50.16 POL`; owner wallet balance is
  approximately `203.93 POL`. These wallet balances are not DEX liquidity.

## Configuration and local verification

- The locally configured owner signer matches the on-chain owner. No key,
  credential or private RPC URL was printed or included in this report.
- No `MODERATOR_V2_SLOT_<N>_*` settings were found in the checked application
  and backend environment files. No payout, referral identity or leader was
  invented. The user was asked for each moderator's public payout address,
  referral code and the single leader designation.
- Targeted Hardhat tests on the isolated local network: **16 passed**:
  `moderator-drip-v2.adversarial.test.js` (11) and
  `moderator-drip.smoke.test.js` (5).
- Frontend `ModeratorCenterV2.json` and `BiggiDripLMToModeratorV2.json` ABIs
  match the compiled backend artifact interfaces.
- This is a targeted readiness check, not an external audit or proof that all
  production launch requirements have been satisfied.

## Remaining execution sequence

1. Obtain the intended payout addresses, referral codes and exactly one leader
   from the user. Not all ten slots need to be enabled.
2. Set the corresponding backend slot configuration. The existing configuration
   script hashes plaintext codes as `keccak256("slot<N>:<code>")`; share the
   matching canonical referral identity with the frontend flow.
3. Run `prepare:configure-moderator-v2:polygon`, review the exact changes and gas
   estimate, then execute the owner-authorized configuration. Verify every slot
   and `operationallyReady()=true`, while keeping Moderator V2 paused.
4. Separately provide DEX liquidity using explicitly agreed asset amounts and
   initial pricing, and satisfy the production launch requirements. Do not
   bypass the activation script's empty-reserve guard or treat dev wallet POL
   as liquidity funding.
5. Rerun `prepare:activate-moderator-v2:polygon`. Only after all prerequisites
   pass, execute activation, validate the receipts and all live references.
6. Synchronize active address manifests, backend environments and frontend
   production configuration with the confirmed on-chain activation. Check Drip
   readers and public contract links as well as the Moderator panel, then test
   and publish the corresponding frontend build. Preserve explicit legacy
   addresses for historical reads rather than silently reusing a V1 ABI.

All npm scripts above belong to `biggi-project/bekend/package.json`.
This session did not deploy a duplicate contract, configure slots, transfer
funds, unpause contracts, change production environment variables, or deploy to
Netlify. Existing NFT metadata and pricing mechanics were not changed.

## References

- [Original deployment report](../biggi-project/bekend/reports/moderator-v2-deployment-polygon.json)
- [Slot configuration script](../biggi-project/bekend/scripts/master/configureModeratorV2.js)
- [Activation checks and wiring](../biggi-project/bekend/scripts/master/activateModeratorV2.js)
- [Frontend Moderator helpers](../src/shared/utils/eth.js)
- [Frontend active addresses](../src/shared/utils/addresses.js)
