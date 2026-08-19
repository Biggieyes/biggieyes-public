# Chainlink File Index

This index links files in this repository that contain direct Chainlink-related references (`Chainlink`, `VRF`, `VRFRouter`, `Upkeep`, `AutomationCompatible`).
Scope: submission surface (`src`, `docs`, app panels, runtime config). Archived contract build artifacts are intentionally excluded.

Generated on: 2026-02-24  
Suggested refresh command:

```bash
rg -n --files-with-matches -S "Chainlink|VRF|VRFRouter|VRFConsumerBase|Coordinator|Upkeep|AutomationCompatible" src functions docs moderator.mhd README.md ARCHITECTURE_DIAGRAM.md
```

## Docs and architecture
- [ARCHITECTURE_DIAGRAM.md](../ARCHITECTURE_DIAGRAM.md)
- [moderator.mhd](../moderator.mhd)
- [docs/system-spec.md](./system-spec.md)
- [docs/abi-audit.md](./abi-audit.md)

## Contract addresses and ABIs
- [src/config/contracts/index.js](../src/config/contracts/index.js)
- [src/config/abi/index.js](../src/config/abi/index.js)
- [src/config/abi/BiggiVRFRouter.json](../src/config/abi/BiggiVRFRouter.json)
- [src/config/abi/BiggiUpkeeperProxy.json](../src/config/abi/BiggiUpkeeperProxy.json)
- [src/config/abi/BiggiDRIPKeeper.json](../src/config/abi/BiggiDRIPKeeper.json)
- [src/config/abi/LiquidityAutomation.json](../src/config/abi/LiquidityAutomation.json)
- [src/config/abi/LiquidityKeeperProxy.json](../src/config/abi/LiquidityKeeperProxy.json)
- [src/config/abi/BiggiMain.json](../src/config/abi/BiggiMain.json)
- [src/shared/utils/addresses.js](../src/shared/utils/addresses.js)
- [src/shared/utils/abi/BiggiVRFReader.json](../src/shared/utils/abi/BiggiVRFReader.json)
- [src/shared/utils/abi/BiggiVRFReader.json.bak](../src/shared/utils/abi/BiggiVRFReader.json.bak)
- [src/shared/utils/abi/upkeepProxy.js](../src/shared/utils/abi/upkeepProxy.js)

## Runtime integration (frontend/services)
- [src/providers/VrfProvider.jsx](../src/providers/VrfProvider.jsx)
- [src/providers/ContractsProvider.jsx](../src/providers/ContractsProvider.jsx)
- [src/shared/utils/vrf.js](../src/shared/utils/vrf.js)
- [src/shared/utils/contract.js](../src/shared/utils/contract.js)
- [src/shared/utils/adminActions.js](../src/shared/utils/adminActions.js)
- [src/shared/services/nftRewardsService.js](../src/shared/services/nftRewardsService.js)
- [src/hooks/useNftRewardsReader.js](../src/hooks/useNftRewardsReader.js)
- [src/hooks/useNFTRewards.js](../src/hooks/useNFTRewards.js)
- [src/common/hooks/useNFTs.js](../src/common/hooks/useNFTs.js)
- [src/lib/mintAuto.js](../src/lib/mintAuto.js)
- [src/ACTIONBUTTONS/MINTTICKET/mintAuto.js](../src/ACTIONBUTTONS/MINTTICKET/mintAuto.js)
- [src/ACTIONBUTTONS/REDEEMTICKET/RedeemFlow.jsx](../src/ACTIONBUTTONS/REDEEMTICKET/RedeemFlow.jsx)
- [src/ACTIONBUTTONS/REDEEMTICKET/RedeemOverlay.jsx](../src/ACTIONBUTTONS/REDEEMTICKET/RedeemOverlay.jsx)
- [src/ACTIONBUTTONS/INFO/ProjectInfoModal.jsx](../src/ACTIONBUTTONS/INFO/ProjectInfoModal.jsx)
- [src/features/vrf/VRFPanel.jsx](../src/features/vrf/VRFPanel.jsx)
- [src/app/panels/VRF/VRFPanel.jsx](../src/app/panels/VRF/VRFPanel.jsx)
- [src/shared/components/NavPanelSwitch.jsx](../src/shared/components/NavPanelSwitch.jsx)
- [src/shared/components/StatusBanner.jsx](../src/shared/components/StatusBanner.jsx)
- [src/components/NftCard.jsx](../src/components/NftCard.jsx)
- [src/features/user/USERPANEL.jsx](../src/features/user/USERPANEL.jsx)
- [src/features/rewards/COLLECTION/CollectionBlocksGrid.BlockCard.jsx](../src/features/rewards/COLLECTION/CollectionBlocksGrid.BlockCard.jsx)
- [src/features/rewards/COLLECTION/CollectionBlocksGrid.constants.js](../src/features/rewards/COLLECTION/CollectionBlocksGrid.constants.js)
- [src/features/admin/InfoPanel.jsx](../src/features/admin/InfoPanel.jsx)
- [src/features/info/trust/components/SecurityBox.jsx](../src/features/info/trust/components/SecurityBox.jsx)
- [src/features/info/trust/components/ContractsTable.jsx](../src/features/info/trust/components/ContractsTable.jsx)
- [src/components/admin/AdminPanel.jsx](../src/components/admin/AdminPanel.jsx)
- [src/UI/ui.js](../src/UI/ui.js)
- [src/locales/projectInfo.js](../src/locales/projectInfo.js)
- [src/shared/texts.js](../src/shared/texts.js)
- [src/app/main.jsx](../src/app/main.jsx)
- [src/app/AppCore.jsx](../src/app/AppCore.jsx)

## Layout/UI references
- [src/components/layout/HeaderControls.jsx](../src/components/layout/HeaderControls.jsx)
- [src/components/layout/GallerySection.jsx](../src/components/layout/GallerySection.jsx)
- [src/components/layout/MainLayout.jsx](../src/components/layout/MainLayout.jsx)
- [src/components/layout/ModalsLayer.jsx](../src/components/layout/ModalsLayer.jsx)
- [src/components/layout/NFTStatusBlock.jsx](../src/components/layout/NFTStatusBlock.jsx)
- [src/components/layout/SiteFooter.jsx](../src/components/layout/SiteFooter.jsx)
