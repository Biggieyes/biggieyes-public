# Pinata Upload (Netlify + React)

This project provides a server-side Pinata upload flow via Netlify functions and a client-side React uploader component.

## Environment variables

Set these in Netlify (Site settings -> Build & deploy -> Environment):

- PINATA_API_KEY
- PINATA_SECRET_API_KEY
- PINATA_JWT (optional, preferred over API key/secret)
- PINATA_GATEWAY_BASE_URL (optional, default `https://biggieyes.mypinata.cloud`)
- ENABLE_NFT_STORAGE_BACKUP (optional, default `false`)
- NFT_STORAGE_KEY (optional; only used when `ENABLE_NFT_STORAGE_BACKUP=true`)

Do NOT commit secrets to git.

## Local setup

1) Create `.env.local` in the repo root (do not commit it):

```
PINATA_API_KEY=your_key
PINATA_SECRET_API_KEY=your_secret
# or use JWT instead
# PINATA_JWT=your_jwt
# optional dedicated gateway override
# PINATA_GATEWAY_BASE_URL=https://biggieyes.mypinata.cloud
# optional backup pin
# ENABLE_NFT_STORAGE_BACKUP=true
# NFT_STORAGE_KEY=your_nft_storage_key
```

2) Install dependencies:

```
npm ci
```

3) Run Netlify dev:

```
netlify dev
```

Functions are available at:
- http://localhost:8888/.netlify/functions/pinFile
- http://localhost:8888/.netlify/functions/pinJson

4) Start the React app in another terminal:

```
npm run dev
```

## Usage

The React component `src/components/PinUploader.jsx` posts to:
- `/.netlify/functions/pinFile` (file upload, returns image CID)
- `/.netlify/functions/pinJson` (metadata JSON, returns metadata CID)

The resulting token URI is:

```
ipfs://<metadataCid>
```

## Verify a CID

- Dedicated Pinata gateway: `https://biggieyes.mypinata.cloud/ipfs/<cid>`
- Fallback Pinata gateway: `https://gateway.pinata.cloud/ipfs/<cid>`
- Any IPFS gateway can work as fallback in read paths.

## Troubleshooting

- 401/403 from Pinata: check API key/JWT permissions.
- 413 / "File too large": file exceeds 5 MB limit.
- 429: rate limit exceeded (10 req/min per function instance).
- Backup pin (nft.storage) is optional and disabled by default.
