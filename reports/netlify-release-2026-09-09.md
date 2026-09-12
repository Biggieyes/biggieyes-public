# Netlify production release - 2026-09-09

## Published artifact

- Production: https://biggieyes.com
- Application: https://biggieyes.com/app/
- Site: `biggieyescom` (`dac321e9-74ae-4e07-b765-33be002cc7e8`).
- Published deploy: `6aa09dcf7a272120ec966e0c` (API state: `ready`).
- Deploy URL: https://6aa09dcf7a272120ec966e0c--biggieyescom.netlify.app
- Build entry: `/assets/app-BG1_dVDx.js`.
- Previous published deploy: `6a9fcdeecf134171e6622bd2`.
- Title: `LiveStats readability and verified mainnet collection structure 2026-09-09`.

Includes the local LiveStats readability changes (six frames and original
button order preserved) and the corrected Collection structure tables,
chapter labels and read fallbacks reviewed on 2026-09-08.

No smart contracts were redeployed or reconfigured. In particular, the
weekly emission-controller changes discussed separately are not implemented
by this frontend deployment. NFT metadata and pricing mechanics are unchanged.
No Netlify environment variables were modified.

## Preflight

- Rebuilt with the production client variables fetched from Netlify in memory.
  Local-only Vite settings were explicitly excluded from that build.
- Vitest: 273 tests passed across 64 files.
- TypeScript check and ESLint error gate passed.
- Repository credential scan and built-output server-credential scan passed.
- Generated the production security headers with the build.
- All four configured primary RPC hostnames returned chain ID 137 and fresh
  block heights: PublicNode, dRPC, Infura and 1RPC. No private URL paths or keys
  are recorded here.
- Built-artifact browser checks passed before upload.

## Production verification

- Netlify API confirmed this deploy is the site's published, ready deploy.
- Public application HTML references the expected new build entry.
- Dashboard widths 390, 768 and 1440: LiveStats data loaded, six frames and
  both button rows retained, gallery present, no horizontal overflow or
  uncaught page errors. Rewards panel and claim preview opened on desktop.
- Collection widths 320, 390, 600, 700, 768, 1024 and 1440: two ten-row
  structure tables, no overflowing cell text, information modal open/close,
  Universe chapter switch and matching Public label all passed.
- `/`, `/api/chat-bootstrap` and `/api/communityVoting`: HTTP 200.
- Browser-only simulated dRPC outage: PublicNode returned successful JSON-RPC
  results; production RPC settings were not changed.
- Production CSP, frame-ancestors restriction, nosniff and HSTS are present.
- No wallet signatures, mint/redeem/claim transactions or authenticated admin
  mutations were performed during browser verification.

The previous published deployment remains available in Netlify for rollback.
