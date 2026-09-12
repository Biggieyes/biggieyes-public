# Collection panel structure review

Scope: local frontend display and read fallbacks only. No contract, metadata,
wallet transaction or production deployment changes.

## Verified source of truth

Read-only Polygon mainnet verification (chain ID 137, block 93456213):

- All five chapter VRF contracts: MAX_SUPPLY = 550.
- All five paired Public contracts: MAX_SUPPLY = 100.
- VRF base/current block prices at that block: 100, 200, 300, 400, 500,
  600, 700, 800, 900 and 1000 POL.
- Each Public current block price matched its paired VRF contract.
- The controller's chapter price-provider addresses matched those VRF contracts.
- All five VRF contracts used Compute
  `0x0A09261631496B4aad9A5c2A82b62666249d773f`.
- Compute background bonuses: 5, 10, 15, 20, 25, 30, 35, 40, 45, 50 percent.
- Compute background growth: 5, 2, 2, 3, 3, 4, 4, 5, 5, 10 percent.

Color order: ORANGE, BLACK, WHITE, BROWN, BLUE, GREEN, VIOLET, RED, PINK,
RAINBOW. These are two distinct percentage schedules, not one.

Local contract sources in
`biggi-project/bekend/contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/`:

- `BiggiMain.sol`: `_totalBlockNFTs`, `_backgroundCountForBlock`,
  `_finalizePendingMint`, `getBlockMintCount`, `setBlockCurrentPrice`.
- `BiggiMain2.sol`: `getEffectiveBlockPrice`, `getCurrentBlockPrice`,
  `getBlockMintCount`, primary mint checks and finalization.
- `BiggiCompute.sol`: `bgBonus`, `bgIncreasePct`.

VRF limits by block are 100, 90, 80, 70, 60, 50, 40, 30, 20, 10.
Each block has ten character IDs, with 10 down to 1 background variants per
character. Up to ten block-completion character rewards are additional to
the 550 mintable VRF NFTs.

On VRF finalization, the background increases its same-color block's price
within that chapter, regardless of the minted NFT's eye color. The contract
then snapshots the NFT's own block price and applies the separate background
bonus to its recorded value. This is not an additional POL payment at redeem.
If eyes and background match, the snapshot includes the just-applied growth.

Public has ten fixed NFTs per block, no selectable background variants and
no background value bonus. Primary mint pays its chapter's live VRF block
price and does not invoke VRF background growth. Existing mint gates remain.
Owners can also set current block prices directly; these are not immutable
price guarantees or secondary-market valuations.

## Corrections

- Replaced the inaccurate static schema image with responsive semantic tables
  using existing shared CORE constants and existing collection read results.
- Removed the obsolete diagram and its incorrect generator.
- Corrected chapter identity, counts, prices, same-color linkage and bonuses.
- Corrected the companion Public price label when changing chapters.
- Retained unknown reads as `--`, not fabricated zero counts or locked gates.
- Stopped falling back to the unused `blockInfos.mintCount` field.
- Public price fallback now uses `getEffectiveBlockPrice`, never the local
  block struct's price when the live provider call fails.
- Total, average and ranking summaries require all ten valid block reads.
- Preserved fractional averages and negative price-change signs.
- Synchronized the shared explanatory constants with the public repo copy.

## Verification

- Focused collection tests: 35 passed.
- Full Vitest suite: 273 passed across 64 files.
- TypeScript check passed.
- ESLint: no errors in changed frontend files; legacy warnings remain.
- Production build passed locally; Netlify was not updated.
- Playwright: widths 320, 390, 600, 700, 768, 1024 and 1440 passed text and
  horizontal overflow checks, two ten-row tables, chapter change, modal
  open/close and paired Public chapter label. No page errors.

Preview: `http://127.0.0.1:5181/app/`, Collections > Originals > Structure.

Published on 2026-09-09 after a fresh production build and validation. See
[Netlify release verification](netlify-release-2026-09-09.md).
