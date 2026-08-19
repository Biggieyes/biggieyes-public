# SEO Audit (BiggiEyes)

## Co bylo před změnou
- Root [`index.html`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/index.html) byl SPA shell (`#root` + JS bootstrap).
- Vite build ([`vite.config.js`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/vite.config.js)) byl single-page entry z root HTML.
- Netlify ([`netlify.toml`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/netlify.toml)) měl globální fallback `/* -> /index.html (200)`.
- V `public/` chyběly povinné SEO soubory (`robots.txt`, `sitemap.xml`) a 404 fallback.
- Routing v Reactu je panel-based bez React Routeru; deep-link parsing běží přes query/hash v `src/app/AppCore.jsx`.

## Co je cílový stav po změně
- Root `/`: statická crawlable landing stránka bez JS závislosti.
- `/app`: stávající SPA dashboard.
- `/app/*`: Netlify fallback na `/app/index.html`.
- Canonical doména: `www` (301 z non-www).
- `robots.txt` + `sitemap.xml` publikované z `public/`.
- `404.html` pro neplatné cesty.

## Riziková poznámka
- URL struktura se mění (`/` je landing, app je `/app/`), ale on-chain logika ani contract interakce se nemění.
