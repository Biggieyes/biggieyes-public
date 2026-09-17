# Originals Public artwork release

Prepared September 17-18, 2026. No Netlify deployment or on-chain write performed.

## Completed

- Renamed 98 images in the user-specified Public Mint Collection directory.
- Preserved source folders, PNG/WebP formats and image bytes. SHA-256 checked
  before and after renaming; no destination overwrites or image edits.
- Retained a byte-identical staged copy of every image and the rename map in
  `tmp-public-originals-release-20260917/`.
- Reviewed all 98 images in ten contact sheets and decoded them in Chromium.
- Published a new 98-image folder and a separate 100-file metadata folder on
  the authenticated existing Pinata account. Existing pins were not removed.
- Verified all 100 remote JSON objects against local release metadata and all
  98 remote image hashes against the original files. The first verification
  timed out after 90 completed entries; the full repeated verification passed.
- Preserved Main ID, Block Index, Block/Eye Color, Linked Block, Chapter,
  Series, Collection Kind, Price Source, names and external URLs.
- Updated only image URI, artwork completion traits (Phase/Image Finalized)
  and the prereveal description for the 98 available images.

Images: `ipfs://bafybeihqm76fpswbbsdi3m56iaolcaitrar6d3pcbwjzbqm5ubyklqynme/`

Metadata: `ipfs://bafybeih6zoc3syewhnngtiuocdtiguiz52cy2qryqdt6vp44iiczvltp5a/`

Source metadata (unchanged on-chain):
`ipfs://bafybeihn4yqga5yuslc2577qsvoajt2fwdpcsr6oj7fdurivwnlrsi7qzy/`

The versioned JSON companion report contains all filenames, hashes and URIs.
Files use Main IDs 1-100; future NFT token IDs are 1001-1100.

## Explicitly incomplete

- White Main IDs **29 and 30** have no source images. Their original prereveal
  JSON is unchanged and the local frontend displays Soon for those selections.
- Contract `0xe56cC0657A89daf10994204eD745985a61b0E36F` (Polygon chain 137)
  still points at its previous prereveal metadata. Observed supply 100, minted
  0, paused true; its metadata consistency report was `(100, true, true)`.
- The owner-controlled block URIs have NOT been updated. This is a separate
  mainnet operation, not something a Pinata upload accomplishes automatically.
- The frontend uses the new images as clearly labeled previews only. It does
  not mark the contract's artwork finalized or bypass mint readiness checks.
- No changes to VRF metadata, ticket metadata, pricing, reward matrices,
  roles, approvals, mint unlocks or financial flows.

## Verification

| Check | Result |
| --- | --- |
| Source rename and SHA-256 verification | PASS, 98 files |
| Full decode and visual review | PASS, 98 files |
| Actual mainnet supply/metadata/URI reads | PASS |
| `python -m unittest discover -s scripts/metadata -p test_biggi_metadata.py` | PASS, 17 tests |
| `python scripts/metadata/biggi_metadata.py validate --path tmp-public-originals-release-20260917/metadata --require-image` | PASS, 100 files |
| `node scripts/metadata/publish-public-artwork.mjs verify tmp-public-originals-release-20260917` | PASS, 100 JSON / 98 SHA-256 hashes |
| Focused Vitest: publicArtworkPreview, collectionPublicPanel, collectionPublicMintFlow, publicMintChapterRouting | PASS, 36 tests |
| ESLint: three changed Public frontend modules | PASS, no findings |
| `npm run typecheck` | PASS |
| `npm run build` | PASS, production artifact plus CSP headers |
| `node scripts/smoke-public-artwork.mjs` | PASS, 1440/768/390/320 px, real remote PNG/WebP, Soon, blocked mint, no page errors or horizontal overflow |
| Complete local app with actual mainnet reads | PASS, Public #1 resolves the new IPFS PNG, image decodes, mint paused, no page errors |
| Real wallet signing, minting and on-chain activation | NOT RUN |
| Netlify deployment | NOT RUN |

Visual tests use fixture prices and contract flags, not evidence of current
live prices. The metadata/contract audit used actual mainnet reads. Browser
test harness JSX and button selectors were corrected before the passing run;
these initial harness failures were not treated as successful visual tests.

Local app: `http://127.0.0.1:5175/app/?panel=collection`, then Public Collection.
Port 5173 was already occupied and was not stopped or replaced.

## Remaining release steps

1. Add and approve the two missing white images with Main IDs 29 and 30.
   Existing 98 assignments must remain stable.
2. Pin the completed version and verify all 100 artwork-to-metadata references.
3. Separately authorize owner updates of the ten Public block base URIs. Verify
   each URI afterwards. Do not reseed the matrix or change pricing.
4. Recheck actual metadata and existing chapter/mint gates. Updating artwork
   alone must not unpause the contract or bypass ticket-phase requirements.
5. Deploy the frontend to Netlify when requested. This turn only prepared and
   built local frontend changes and published IPFS assets.
