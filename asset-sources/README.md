Original image sources that are not needed at runtime live here.

Purpose:
- keep large source assets in the repo
- keep them out of Vite `public/` so they are not copied into `dist/`
- allow local optimization scripts to regenerate shipped assets

Current scripts that read from this folder when present:
- `scripts/generate-optimized-backgrounds.ps1`
- `scripts/generate-header-logo-images.ps1`
- `scripts/generate-expansion-roadmap-images.ps1`
- `scripts/generate-reward-preview-fallbacks.ps1`
- `scripts/generate-tolanding-images.ps1`
- `scripts/generate-ui-fallback-copies.ps1`

Additional archived assets:
- `asset-sources/public-root-block-duplicates/` stores root-level `public/Biggi_*.png` files that duplicated `public/images/blocks/...` byte-for-byte and are not used by runtime paths.
- `asset-sources/public/images/rewards/{block,orange,rainbow}/` stores large unused rewards image trees that are not referenced by the active UI. Runtime still uses `public/images/rewards/characters/` and `public/images/rewards/rainbowNFT/`.
- `asset-sources/public/images/rewards/{characters,rainbowNFT}/*.png` stores original rewards preview fallback images after runtime switched to `*.optimized.jpg` fallbacks.
- `asset-sources/public/images/{mint,claim,redeem-button,main-logo1,main-logo2}.png` and `asset-sources/public/images/icons/{info,rewards,collection,mint,token,users,expansion}.png` store large original PNG files for buttons, logos, and nav icons after runtime switched to lightweight `*.fallback.png` copies.
- `asset-sources/public/images/expansion-roadmap/color-of-clothing.png` stores an unused roadmap source image that is not referenced by the active UI.
- `asset-sources/public/images/icons/{rewards1,BIGGI TOKENOMIC MAPs,collectionh,collection0}.png` stores unused legacy icon variants that are not referenced by the active UI.
- `asset-sources/public/images/tolanding/*.png` stores the original landing screenshots after they were replaced in runtime with `landing-preview-*.optimized.jpg`.
