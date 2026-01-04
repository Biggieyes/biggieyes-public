# Pinata Upload (Netlify + React)

This project provides a server-side Pinata upload flow via Netlify functions and a client-side React uploader component.

## Environment variables

Set these in Netlify (Site settings -> Build & deploy -> Environment):

- PINATA_API_KEY
- PINATA_SECRET_API_KEY
- PINATA_JWT (optional, preferred over API key/secret)
- NFT_STORAGE_KEY (optional backup pinning)

Do NOT commit secrets to git.

## Local setup

1) Create `.env.local` in the repo root (do not commit it):

```
PINATA_API_KEY=your_key
PINATA_SECRET_API_KEY=your_secret
# or use JWT instead
# PINATA_JWT=your_jwt
# optional backup pin
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

- Pinata gateway: https://gateway.pinata.cloud/ipfs/<cid>
- Any IPFS gateway should also work.

## Troubleshooting

- 401/403 from Pinata: check API key/JWT permissions.
- 413 / "File too large": file exceeds 5 MB limit.
- 429: rate limit exceeded (10 req/min per function instance).
- Backup pin (nft.storage) failures are logged server-side and do not fail the primary Pinata pin.
