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

Any missing final image falls back to the placeholder image and is counted in
`_metadata_manifest.json`.

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

## Ticket metadata

TicketHub always resolves the same filename:
`Biggi_RANDOM_MINT_TICKET.json`.

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
