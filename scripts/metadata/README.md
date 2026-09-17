# BIGGI NFT Metadata Pipeline

This folder contains a stdlib-only Python helper for BIGGI NFT metadata and
Pinata uploads. It is designed for two phases:

- `placeholder`: metadata is OpenSea-readable and points every NFT to one
  prereveal/marketing image URI.
- `final`: metadata keeps the same contract filenames but replaces `image`
  values from a CID/URI map after final artwork is pinned.

The script does not upload anything unless `pinata-upload --execute` is used.
For folder uploads, use the exact `IPFS folder base` printed by the command;
the multipart upload uses one common root, while the returned CID exposes the
folder contents directly.

## Existing BIGGI metadata source

The current legacy source set can be audited without changing it:

```powershell
python scripts/metadata/biggi_metadata.py audit-legacy `
  --metadata-root "C:\Users\biggi\OneDrive\Obrázky\Desktop\BIGGIEYES NFT\!!!NFT COLLECTION!!!\BIGGI_METADATA2" `
  --image-root "C:\Users\biggi\OneDrive\Obrázky\Desktop\BIGGIEYES NFT\!!!NFT COLLECTION!!!\BIGGIEYES VRF COLLECTION"
```

Use this as the first check before any Pinata upload or on-chain URI update.

## 50 marketing tickets before final VRF images

This does not require final collection artwork. TicketHub resolves every ticket
to one shared file:

```text
ticketBaseURI + Biggi_RANDOM_MINT_TICKET.json
```

Prepare a release folder from the existing ticket metadata:

```powershell
python scripts/metadata/biggi_metadata.py prepare-ticket-release `
  --metadata-root "C:\Users\biggi\OneDrive\Obrázky\Desktop\BIGGIEYES NFT\!!!NFT COLLECTION!!!\BIGGI_METADATA2" `
  --marketing-count 50 `
  --out metadata-out/marketing-ticket-release
```

The output includes:

- `Biggi_RANDOM_MINT_TICKET.json`
- `marketing-ticket-release.json`
- `env.fragment.example` with `SALE_CAP=500`, `MARKETING_CAP=50`, and
  `TICKET_BASE_URI=ipfs://<TICKET_METADATA_FOLDER_CID>/`

Then pin `metadata-out/marketing-ticket-release` to Pinata and set
`TicketHub.setTicketBaseURI(...)`. Do not redeem tickets until VRF, MAIN
metadata, and final collection gates are ready.

## Why filenames matter

The deployed BIGGI contracts build token URIs from base URI plus a deterministic
filename:

- `MAIN`: `Biggi_<mainId>_<BLOCK>_<BACKGROUND>.json`
- `MAIN2`: `Biggi_<mainId>_<BLOCK>_PUBLIC.json`
- TicketHub: `Biggi_RANDOM_MINT_TICKET.json`

So the metadata folder must contain files with those names. Plain `1.json`,
`2.json` files are not enough for these contracts.

## Placeholder marketing metadata

First pin or host one prereveal image, then generate metadata that uses it:

```powershell
python scripts/metadata/biggi_metadata.py build `
  --collection-kind main `
  --phase placeholder `
  --collection-name "BIGGI" `
  --description "BIGGI prereveal metadata. Final artwork is revealed after VRF." `
  --placeholder-image-uri "ipfs://<PLACEHOLDER_IMAGE_CID>/placeholder.png" `
  --external-url "https://<YOUR_SITE>/nft" `
  --out metadata-out/main-placeholder
```

Validate before uploading:

```powershell
python scripts/metadata/biggi_metadata.py validate `
  --path metadata-out/main-placeholder `
  --require-image
```

Upload the whole metadata folder to Pinata only when ready:

```powershell
python scripts/metadata/biggi_metadata.py pinata-upload `
  --path metadata-out/main-placeholder `
  --name "biggi-main-placeholder-metadata" `
  --env-file .env.local
```

The command above is a dry run. Add `--execute` only when you intentionally want
to write to Pinata.

After Pinata returns a metadata folder CID, set every block base URI to that
folder:

```text
MAIN_BLOCK_URI_1=ipfs://<METADATA_FOLDER_CID>/
...
MAIN_BLOCK_URI_10=ipfs://<METADATA_FOLDER_CID>/
MAIN_METADATA_FILE=metadata-out/main-placeholder/layout.json
```

The generated `env.fragment.example` contains this shape.

## Final image metadata

Create a CSV or JSON map when final image CIDs are ready. CSV examples:

```csv
filename,image
Biggi_1_ORANGE_O.json,ipfs://bafy.../Biggi_1_ORANGE_O.png
```

```csv
idx,image
1,ipfs://bafy.../Biggi_1_ORANGE_O.png
```

```csv
blockIdx,mainId,background,cid,path
1,1,1,bafy...,Biggi_1_ORANGE_O.png
```

Then regenerate final metadata:

```powershell
python scripts/metadata/biggi_metadata.py build `
  --collection-kind main `
  --phase final `
  --collection-name "BIGGI" `
  --description "BIGGI final metadata." `
  --placeholder-image-uri "ipfs://<PLACEHOLDER_IMAGE_CID>/placeholder.png" `
  --image-map path/to/final-image-cids.csv `
  --external-url "https://<YOUR_SITE>/nft" `
  --out metadata-out/main-final
```

For MAIN, any missing final image falls back to the placeholder image and is
counted in `_metadata_manifest.json`. Public MAIN2 final releases are strict:
all 100 explicit final image URIs must be present before any output is written.

## MAIN2 public branch

For `MAIN2`, use `--collection-kind main2`. The contract's `tokenURI()` uses the
`PUBLIC` suffix. It has exactly 100 independently mintable NFTs: ten unique
NFTs in each of the ten blocks. The generated Public layout therefore contains
100 rows and 100 unique metadata files. Public has no colored background
variants and its metadata contain no background or price traits.

`BiggiMain2` reads the live price of the matching block from its paired VRF
collection. It does not store an independent Public base-price curve and does
not add any background adjustment.

Generate a chapter-aware prereveal set like this:

```powershell
python scripts/metadata/biggi_metadata.py build `
  --collection-kind main2 `
  --phase placeholder `
  --collection-name "BIGGI Universe Public" `
  --chapter-id 2 `
  --series "Universe" `
  --description "BIGGI Universe public companion collection." `
  --placeholder-image-uri "ipfs://<PUBLIC_PLACEHOLDER_CID>/universe-public.png" `
  --external-url "https://biggieyes.com/collection" `
  --out metadata-out/universe-public-placeholder
```

For final artwork, map one image to each contract filename:

```csv
filename,image
Biggi_1_ORANGE_PUBLIC.json,ipfs://bafy.../Biggi_1_ORANGE_PUBLIC.png
Biggi_2_ORANGE_PUBLIC.json,ipfs://bafy.../Biggi_2_ORANGE_PUBLIC.png
```

Use `PUBLIC_BLOCK_URI_1..10` and `PUBLIC_METADATA_FILE` for the public branch.

### Public Originals artwork preparation

Originals is Chapter 1 (`--chapter-id 1 --series Original`). Use one approved
image per Main ID, not the older `_PUBLIC_ORANGE_O` or VRF `_ORANGE_O` background
variants. No image editing or background removal is performed by this pipeline.
The restriction concerns background variants/traits, not scene content in the
artwork. The block mapping is fixed:

| Main IDs / mint indices | Block | Example image filename |
| --- | --- | --- |
| 1-10 | ORANGE | `Biggi_1_ORANGE_PUBLIC.png` |
| 11-20 | BLACK | `Biggi_11_BLACK_PUBLIC.png` |
| 21-30 | WHITE | `Biggi_21_WHITE_PUBLIC.png` |
| 31-40 | BROWN | `Biggi_31_BROWN_PUBLIC.png` |
| 41-50 | BLUE | `Biggi_41_BLUE_PUBLIC.png` |
| 51-60 | GREEN | `Biggi_51_GREEN_PUBLIC.png` |
| 61-70 | VIOLET | `Biggi_61_VIOLET_PUBLIC.png` |
| 71-80 | RED | `Biggi_71_RED_PUBLIC.png` |
| 81-90 | PINK | `Biggi_81_PINK_PUBLIC.png` |
| 91-100 | RAINBOW | `Biggi_91_RAINBOW_PUBLIC.png` |

PNG, JPEG and WebP source files are supported. Public on-chain token IDs are
1001-1100; filenames use Main IDs 1-100. The internal layout `background=1`
remains unchanged and is not a Public background trait or price modifier.

Audit the source folder without modifying, copying, uploading or approving it:

```powershell
python scripts/metadata/biggi_metadata.py audit-public-artwork `
  --image-root "C:\path\to\approved-public-artwork" `
  --out tmp-public-artwork-audit
```

Use a new/empty output directory outside the source artwork folder. Outputs:

- `public-artwork-audit.json`: missing files, wrong block/ID names, legacy
  background variants, ambiguous matches, invalid file headers, duplicate bytes,
  and SHA-256 fingerprints of matched files.
- `public-image-map.csv`: all 100 deterministic metadata filenames, expected
  image stems and matched source paths. The `image` column is intentionally empty.

An incomplete mapping returns a nonzero exit code after writing the report.
`mappingComplete=true` checks filenames, basic file headers and duplicate bytes
only. It does not prove full image decoding, correct eye colors, visual uniqueness,
or final artwork approval. Review the images before pinning them. Unassigned and
legacy source files are listed but never selected automatically.

After artwork approval, pin only the selected images and fill each CSV `image`
cell with its actual IPFS image URI. Keep the CSV outside the upload folder.
Do not upload the entire mixed legacy source folder or use local file paths.
Then generate the release into a new/empty directory:

```powershell
python scripts/metadata/biggi_metadata.py build `
  --collection-kind main2 --phase final `
  --collection-name "BIGGI Originals Public" `
  --chapter-id 1 --series Original `
  --description "BiggiEyes Originals public companion collection." `
  --image-map tmp-public-artwork-audit/public-image-map.csv `
  --external-url "https://biggieyes.com/collection/" `
  --out tmp-public-originals-final

python scripts/metadata/biggi_metadata.py validate `
  --path tmp-public-originals-final --require-image
```

The final Public build rejects missing images even with `--allow-missing-image`,
configured placeholder URIs, duplicate URIs, conflicting map entries, local paths,
template CID placeholders and recognizable wrong-NFT/background image filenames.
Remote image content/availability is not verified by `build` or `validate`.
The generated layout preserves all 100 index/block/Main ID mappings. MAIN/VRF
metadata generation, background traits and on-chain pricing are unchanged.

Building or auditing does not upload metadata, update contract URIs, unlock a
chapter or unpause minting. Those remain separate release steps after image,
metadata, contract wiring and purchase-preflight verification.

### Originals Public artwork completion (2026-09-18)

The complete release adds `Biggi_29_WHITE_PUBLIC.webp` and
`Biggi_30_WHITE_PUBLIC.webp`. All 98 previously published image assignments and
SHA-256 hashes are unchanged. There are now 100 images and 100 final metadata
files, with no missing artwork IDs. The frontend registry points to:

- Images: `ipfs://bafybeigj2tc6mfb22dexhtlka7hnyepqxwxnegsppuw7xrzc3bbdbtwn6i/`
- Metadata: `ipfs://bafybeid6oc2tj7a7kenoqeidcdpbd7rg5fgy34qc2hc2wla7ldvlftd5x4/`

The source metadata CID, on-chain block URIs, mint activation and all pricing
and reward rules remain unchanged. A complete Pinata release is not an on-chain
metadata update. New staging files and receipts are in
`tmp-public-originals-release-20260918/`; the preceding release is retained.
See `reports/public-originals-complete-release-2026-09-18.md` for the production
deployment, complete verification results and unchanged on-chain boundaries.

### Preceding Originals Public artwork release (2026-09-17)

The preceding prepared release contained 98 original images. White Main IDs 29 and
30 remained prereveal. See `reports/public-originals-artwork-2026-09-17.json` for
the complete old/new filename mapping, SHA-256 hashes and verified IPFS URIs.
The source PNG/WebP formats and bytes are unchanged.

`prepare-public-artwork.mjs SOURCE OUTPUT` creates byte-identical staging copies,
a rename plan and browser-rendered review sheets in an empty output directory.
It does not rename source files. Existing canonical IDs take precedence; new
files use ordinal filename order within each eye-color folder. Review the map
before applying any source renames. Do not reassign already published IDs.

`publish-public-artwork.mjs STAGE OUTPUT` is restricted to Chapter 1 Public on
Polygon, contract `0xe56cC0657A89daf10994204eD745985a61b0E36F`. Stages are explicit:

- `snapshot`: read chain ID, paused state, zero minted supply, all block URIs and
  all 100 existing prereveal metadata files; validate the fixed Public matrix.
- `pin-images`: upload the reviewed image copies; requires `PINATA_JWT` in
  `biggi-project/bekend/.env.core.polygon`. **This is an actual Pinata upload.**
- `metadata`: preserve all non-artwork fields and traits. Update image URI,
  description, Phase and Image Finalized only for available images. Missing
  images retain their original JSON unchanged.
- `pin-metadata`: **upload** the new 100-file metadata folder as a separate pin.
- `verify`: read every published JSON and image, compare all JSON fields and
  image SHA-256 hashes. Retries are bounded and apply only to reads, never uploads.

No stage signs transactions, updates contract URIs, unpauses minting or deploys
Netlify. The frontend registry `publicOriginalsArtwork.json` displays a labeled
preview only for the matching chain, chapter, contract and known prereveal URI.
The mint preflight still reads the contract's own metadata and requires its
Image Finalized status. Finalized or unrelated on-chain metadata is never
overridden. Updating owner-controlled block URIs is a separate release decision.

## Ticket metadata

TicketHub always resolves the same filename:
`Biggi_RANDOM_MINT_TICKET.json`.

Ticket traits are intentionally limited to stable, public filters used by
marketplaces: `Ticket Type`, `Chapter`, `Series`, and `Mint Mechanism`.
Activation state and metadata preparation state must not be traits because
they change over the lifetime of a chapter.

```powershell
python scripts/metadata/biggi_metadata.py build-ticket `
  --phase placeholder `
  --name "BIGGI Random Mint Ticket" `
  --description "Redeemable BIGGI ticket. Final NFT is assigned through VRF." `
  --placeholder-image-uri "ipfs://<TICKET_PLACEHOLDER_IMAGE_CID>/ticket.png" `
  --external-url "https://<YOUR_SITE>/ticket" `
  --out metadata-out/ticket-placeholder
```

After upload, configure:

```text
TICKET_BASE_URI=ipfs://<TICKET_METADATA_FOLDER_CID>/
```

For the deployed Polygon TicketHub, the guarded metadata migration is:

```powershell
cd biggi-project/bekend
npm run prepare:ticket-metadata:polygon
npm run set:ticket-metadata:polygon
```

OpenSea caches metadata separately. After setting `OPENSEA_API_KEY` in the
ignored `.env.core.polygon`, queue all five 50-ticket chapter ranges with:

```powershell
npm run prepare:opensea-ticket-refresh
npm run refresh:opensea-tickets
```

## Contract-level metadata

For `contractURI()`, create one collection-level JSON:

```powershell
python scripts/metadata/biggi_metadata.py build-contract `
  --name "BIGGI" `
  --description "BIGGI NFT collection." `
  --image-uri "ipfs://<COLLECTION_IMAGE_CID>/collection.png" `
  --external-link "https://<YOUR_SITE>" `
  --out metadata-out/main-contract/contract.json
```

Pin the JSON or folder, then set the returned URI through the matching
`setContractURI(...)` call.

## Pinata credentials

Use server-side environment variables only:

- `PINATA_JWT` preferred
- or `PINATA_API_KEY` + `PINATA_SECRET_API_KEY`
- optional `PINATA_GATEWAY_BASE_URL`

Do not commit secrets to git.
