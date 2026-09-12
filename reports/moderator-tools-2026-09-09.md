# Moderator Tools frontend update - 2026-09-09

Local-only change. No Netlify deployment, environment update or blockchain
transaction was made. Moderator V2 activation still requires the intended
moderator payout addresses, referral identities, a single leader and funded
DEX liquidity, followed by the existing activation checks.

## Changes

- Removed WeeklySummaryBuilder/Supabase and MerkleTool from the Moderator Tools
  tab. ModeratorCenterV2 does not use those inputs to settle weekly rewards.
  The standalone legacy components were not deleted or changed.
- Tools now reads the selected week's allocation, credited amount, rollover,
  settlement state, configuration version and historical slot activity directly
  from ModeratorCenterV2 on Polygon mainnet.
- Slot payout addresses and roles use `getWeekSlotConfig`, not today's slot
  assignments. Pool totals are separate from slot weights; the UI does not
  invent an individual payout estimate or treat a pool as wallet claimable POL.
- Reads use one pinned Polygon block and one multicall for an unopened week,
  or two for a week with a snapshot. Typing a week does not send RPC requests;
  submitting, navigating or explicitly refreshing does. No polling was added.
- Exact wei amounts remain strings in JSON exports. Failed reads clear the
  report and disable export instead of displaying stale results or fake zeros.
- Added week navigation, current-week action, wallet filter, JSON download,
  explorer links and a return to the existing moderator rewards view.
- Contract setup is labelled separately from activation. RPC failure is no
  longer displayed as proof that the configured contract is a legacy version.
- Referral links now support slot 0, encode special characters, replace stale
  query/hash referral values, and link to `/app/` rather than the landing page.
- Preserved the project's existing colors and button treatment. The new Tools
  layout is unframed within the panel, with an internally scrollable table.

## Verification

- Full frontend suite: 292 tests passed across 66 files.
- Additional shared multicall pinned-block regression: 1 test passed.
- Typecheck and targeted ESLint checks passed.
- Secret scan passed.
- `npm run build` passed; generated application entry is local, not published.
- Playwright exercised actual mainnet read-only data through the built app:
  Community Center > Moderator Center > Tools. Verified unopened-week state,
  previous/current week navigation, download and return to the Moderator tab.
- Desktop/tablet/mobile widths 1440, 768, 390 and 320 had no document or control
  overflow, and the browser emitted no uncaught JavaScript errors.
- Filled historical-week data, wallet filtering, exact large wei amounts,
  settlement timing, wrong-chain rejection and RPC failures have local unit
  coverage. No real moderator slots or payout transactions were created for
  testing; V2 currently has no configured moderators.

## Files

- `src/features/admin/MODERATORCENTER/ModeratorTools.jsx`
- `src/features/admin/MODERATORCENTER/ModeratorTools.css`
- `src/features/admin/MODERATORCENTER/moderatorWeek.js`
- `src/features/admin/MODERATORCENTER/MODERATORCENTERPanel.jsx`
- `src/shared/utils/multicall.js`
- `src/shared/utils/referrals.js`
- Tests: `moderatorTools.test.jsx`, `moderatorWeek.test.js`,
  `multicallSnapshot.test.js`, `referrals.test.js` in `__tests__/`.
