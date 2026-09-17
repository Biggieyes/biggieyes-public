# Originals Public completion and production release

Completed September 18, 2026 (Europe/Prague).

## Artwork

- Added and renamed only the two new WHITE images, with byte-preserving SHA-256 checks:
  - `gen_01kknh9841eks9yjba7t0dymxk.webp` -> `Biggi_29_WHITE_PUBLIC.webp`
  - `gen_01kkt16t47e2ht3c5knagr4xkg.webp` -> `Biggi_30_WHITE_PUBLIC.webp`
- All 98 preceding image IDs, filenames and SHA-256 hashes are unchanged.
- All 100 staged images decoded in Chromium. The new white images were visually reviewed.
- Pinata now holds a separate complete 100-image folder and 100-file final metadata folder.
- All 100 remote JSON objects matched staged metadata; all 100 remote images matched source SHA-256 hashes.
- Existing pins and the preceding release were preserved.

Images: `ipfs://bafybeigj2tc6mfb22dexhtlka7hnyepqxwxnegsppuw7xrzc3bbdbtwn6i/`

Metadata: `ipfs://bafybeid6oc2tj7a7kenoqeidcdpbd7rg5fgy34qc2hc2wla7ldvlftd5x4/`

Main ID 29 SHA-256: `ec1fe94d47600134e78cd7552fc75716a6b1a73e4fdefba2912c7a40dcd17bec`

Main ID 30 SHA-256: `f982ddc40edf5b5c2741ddc0e74b24cea0f8821a70140ce2186c4ac8a6859cec`

Receipts, per-image mappings, source snapshot and verification:
`tmp-public-originals-release-20260918/` (local ignored staging).
The initial PowerShell rename attempt failed due to UTF-8 decoding of the Czech path and made no changes. The corrected UTF-8, fail-fast pass renamed and hash-verified both files.

## Preserved On-Chain State

Polygon mainnet contract: `0xe56cC0657A89daf10994204eD745985a61b0E36F`.
Snapshot confirmed supply 100, minted 0, paused true, metadata consistency `(100, true, true)`.
All ten block base URIs and all source metadata matched the preceding snapshot.

On-chain metadata still uses:
`ipfs://bafybeihn4yqga5yuslc2577qsvoajt2fwdpcsr6oj7fdurivwnlrsi7qzy/`

Frontend changes display completed artwork as previews only. They do not bypass mint checks.
No contract URI updates, mint activation, transactions, permissions, pricing, reward rules,
ticket metadata, VRF metadata or financial flows were changed.

## Production

- Site: `biggieyescom`, `dac321e9-74ae-4e07-b765-33be002cc7e8`.
- Exact domain: https://biggieyes.com/app/?panel=collection
- Published deployment: `6aac765d9de46350e63ee8fb`.
- Deploy URL: https://6aac765d9de46350e63ee8fb--biggieyescom.netlify.app
- Previous deployment: `6aa6c6706ef7b015a357096f`.
- App entry: `/assets/app-BwnBGRo6.js`.
- Artifact SHA-256: `ba7bfbf85b9f577e072708821bc96bd98960a27e44ea5cca1fd7aa6ce5f879fd`.
- Published at `2026-09-17T23:23:38.330Z`; HTTP/API publication verified at `2026-09-17T23:23:56.786Z`.
- Includes the earlier gallery MetaMask import controls for NFTs and tickets.
- Built using 20 production client variables fetched into child-process memory.
  No Netlify environment or DNS settings changed. Artifact/environment hashes and
  previous deployment were rechecked before publication.
- Root `dist` and existing `functions` deployed with an explicit site ID, `--prod --no-build`.
  No commit, push or repository cleanup performed; artifact includes existing uncommitted work.
- Deployment and configuration fingerprint receipt: `tmp-netlify-public-complete-20260918.json`.

## Verification

| Check | Result |
| --- | --- |
| Preparation, stable ID/hash comparison | PASS, 100 images / original 98 unchanged |
| Metadata validate command | PASS, 100 files |
| Metadata Python unit tests | PASS, 17 tests |
| Focused Vitest: Public preview/panel/mint/routing, gallery import/lifecycle, wallet reconnect/provider selection, identity | PASS, 119 tests in 13 files |
| `npm run lint`, `npm run typecheck` | PASS |
| `npm run security:secrets`, built known-credential scan | PASS; not a complete security audit |
| `git diff --check` | PASS; existing unrelated CRLF notices only |
| Production RPC health | PASS, four independent fresh Polygon chain-137 endpoints |
| Production-configured build and CSP generation | PASS |
| Full IPFS verification | PASS, 100 JSON / 100 image hashes |
| Public panel fixture at 1440/768/390/320 px | PASS; actual Pinata images 29 and 30 decoded, no overflow/page errors, mint remained disabled |
| Complete built-app smoke | PASS; gallery, LiveStats, rewards, disconnected user panel, desktop/mobile |
| Published deployment and HTTP checks | PASS; correct entry and ready/published ID; `/`, `/app/`, chat and voting API return 200 |
| Production security headers | PASS; CSP, HSTS, nosniff |
| Live Public panel at 1440/390 px | PASS; both white images from the new CID decoded, no page errors/overflow, mint still paused |
| Live chat/voting API JSON shape | PASS; expected keys and `ok: true`, user content not printed |
| Real MetaMask confirmation, mainnet transactions, mint activation | NOT RUN |

Fixture prices are not measurements of live prices. Live verification used real read-only
contract data. Screenshots of the fixture and production panels were inspected.
Production can be rolled back by republishing the previous deployment; IPFS pins and
blockchain state are independent of that rollback.
