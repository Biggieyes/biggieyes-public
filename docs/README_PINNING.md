# Pinata Upload (Netlify + React)

This project provides a server-side Pinata upload flow via Netlify functions and a client-side React uploader component.

## Environment variables

Set these in Netlify (Site settings -> Build & deploy -> Environment):

- PINATA_API_KEY
- PINATA_SECRET_API_KEY
- PINATA_JWT (optional, preferred over API key/secret)
- PINATA_GATEWAY_BASE_URL (optional, default `https://biggieyes.mypinata.cloud`)
- PINATA_UPLOAD_OWNER_ADDRESS (optional; defaults to `CHAT_OWNER_ADDRESS`)
- ENABLE_NFT_STORAGE_BACKUP (optional, default `false`)
- NFT_STORAGE_KEY (optional; only used when `ENABLE_NFT_STORAGE_BACKUP=true`)

Do NOT commit secrets to git.

## Local setup

1. Create `.env.local` in the repo root (do not commit it):

```
PINATA_API_KEY=your_key
PINATA_SECRET_API_KEY=your_secret
# or use JWT instead
# PINATA_JWT=your_jwt
# optional dedicated wallet allowed to authorize uploads
# PINATA_UPLOAD_OWNER_ADDRESS=0x...
# optional dedicated gateway override
# PINATA_GATEWAY_BASE_URL=https://biggieyes.mypinata.cloud
# optional backup pin
# ENABLE_NFT_STORAGE_BACKUP=true
# NFT_STORAGE_KEY=your_nft_storage_key
```

2. Install dependencies:

```
npm ci
```

3. Run Netlify dev:

```
netlify dev
```

Functions are available at:

- http://localhost:8888/.netlify/functions/pinFile
- http://localhost:8888/.netlify/functions/pinJson

4. Start the React app in another terminal:

```
npm run dev
```

## Usage

The React component `src/components/PinUploader.jsx` asks the configured owner
wallet to sign each exact request body, then posts to:

- `/.netlify/functions/pinFile` (file upload, returns image CID)
- `/.netlify/functions/pinJson` (metadata JSON, returns metadata CID)

Unsigned, expired, modified, or non-owner requests are rejected before Pinata
credentials are used. The wallet must be connected to Polygon mainnet.

The resulting token URI is:

```
ipfs://<metadataCid>
```

## Collection metadata pipeline

For BIGGI contract-compatible collection metadata, use:

```
python scripts/metadata/biggi_metadata.py --help
```

The helper generates the exact `Biggi_<mainId>_<BLOCK>_<BACKGROUND>.json`
filenames expected by `BiggiMain`, the `PUBLIC` filenames expected by
`BiggiMain2`, and the fixed `Biggi_RANDOM_MINT_TICKET.json` file expected by
TicketHub. It supports prereveal placeholder metadata first, then final image
CID replacement from a CSV/JSON map.

Pinata uploads from that helper are dry-run by default and require `--execute`.

## Verify a CID

- Dedicated Pinata gateway: `https://biggieyes.mypinata.cloud/ipfs/<cid>`
- Fallback Pinata gateway: `https://gateway.pinata.cloud/ipfs/<cid>`
- Any IPFS gateway can work as fallback in read paths.

## Troubleshooting

- 401/403 from Pinata: check API key/JWT permissions.
- 401/403 from the Netlify function: connect the configured owner wallet and sign the request.
- 413 / "File too large": file exceeds 5 MB limit.
- 429: rate limit exceeded (10 req/min per function instance).
- Backup pin (nft.storage) is optional and disabled by default.
