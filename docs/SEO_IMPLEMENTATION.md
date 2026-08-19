# SEO Implementation (Landing `/` + SPA `/app`)

## Souhrn změn
- Root `/` je statická landing stránka bez závislosti na JavaScriptu.
- Stávající React/Vite SPA běží pod `/app/` přes samostatný `app/index.html`.
- Netlify routing je upraven na:
  - canonical doménu `www`,
  - SPA fallback pouze pro `/app/*`,
  - bez globálního fallbacku pro root.
- Přidány povinné SEO soubory: `robots.txt`, `sitemap.xml`.
- Přidána `404.html`.
- Přidány OG/favicons assety (`og-biggieyes.png`, `favicon.ico`, `apple-touch-icon.png`).

## Seznam změněných souborů
- [`index.html`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/index.html)
- [`app/index.html`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/app/index.html)
- [`vite.config.js`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/vite.config.js)
- [`netlify.toml`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/netlify.toml)
- [`public/robots.txt`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/public/robots.txt)
- [`public/sitemap.xml`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/public/sitemap.xml)
- [`public/404.html`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/public/404.html)
- [`public/og/og-biggieyes.png`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/public/og/og-biggieyes.png)
- [`public/favicon.ico`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/public/favicon.ico)
- [`public/apple-touch-icon.png`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/public/apple-touch-icon.png)
- [`docs/SEO_AUDIT.md`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/docs/SEO_AUDIT.md)
- [`docs/SEO_IMPLEMENTATION.md`](/c:/Users/biggi/OneDrive/Obrázky/Desktop/FRONTEND/BIGGINFTWEB/docs/SEO_IMPLEMENTATION.md)

## Jak otestovat (lokálně + po deployi)
1. Spusť `npm run build`.
2. Ověř build výstup:
   - `dist/index.html` (landing)
   - `dist/app/index.html` (SPA)
   - `dist/robots.txt`, `dist/sitemap.xml`, `dist/404.html`
3. Ověř source root stránky:
   - `title`, `meta description`
   - canonical `https://www.biggieyes.com/`
   - OG/Twitter meta
   - JSON-LD (`Organization`, `WebSite`)
4. Ověř crawl soubory:
   - `/robots.txt` obsahuje `Sitemap: https://www.biggieyes.com/sitemap.xml`
   - `/sitemap.xml` obsahuje URL `/` a `/app/`
5. Ověř routing:
   - `/app/` načte SPA
   - `/app/*` padá na `/app/index.html` (Netlify fallback)
6. Po deployi ověř:
   - `https://biggieyes.com/*` -> 301 na `https://www.biggieyes.com/:splat`
   - root `/` je čitelný i bez JS
   - `/app` a `/app/*` fungují.

## Poznámka
Tato změna mění URL strukturu (app na /app), ale nemění on-chain logiku ani contract interakce.
