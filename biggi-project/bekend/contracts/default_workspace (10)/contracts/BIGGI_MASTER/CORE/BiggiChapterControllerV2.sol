// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./BiggiSeriesRegistry.sol";

interface IBiggiTicketHubChapterViewV2 {
    function saleMinted() external view returns (uint16);
    function marketingMinted() external view returns (uint16);
    function saleCap() external view returns (uint16);
    function marketingCap() external view returns (uint16);
    function totalMinted() external view returns (uint256);
    function totalCap() external view returns (uint16);
    function mainCollection() external view returns (address);
    function chapterSaleMinted(uint256 chapterId) external view returns (uint16);
    function chapterMarketingMinted(uint256 chapterId) external view returns (uint16);
    function chapterTotalMinted(uint256 chapterId) external view returns (uint256);
    function chapterSaleCap(uint256 chapterId) external view returns (uint16);
    function chapterMarketingCap(uint256 chapterId) external view returns (uint16);
    function chapterTotalCap(uint256 chapterId) external view returns (uint16);
    function chapterMainCollection(uint256 chapterId) external view returns (address);
}

interface IBiggiMainChapterViewV2 {
    function ticketHub() external view returns (address);
}

error ChapterControllerV2ZeroAddress();
error ChapterControllerV2OwnerZero();
error ChapterControllerV2InvalidChapter();
error ChapterControllerV2CapMismatch();
error ChapterControllerV2RegistryMismatch();
error ChapterControllerV2StackMismatch();
error ChapterControllerV2HubCapsMismatch();
error ChapterControllerV2InvalidUnlockThreshold();
error ChapterControllerV2UnlockThresholdLocked();

contract BiggiChapterControllerV2 is Ownable {
    struct ChapterConfig {
        bool exists;
        uint16 saleCap;
        uint16 marketingCap;
        uint16 totalCap;
    }

    BiggiSeriesRegistry public immutable registry;
    mapping(uint256 => ChapterConfig) public chapterConfig;
    mapping(uint256 => uint16) public publicUnlockSaleThreshold;
    mapping(uint256 => bool) public publicUnlockThresholdLocked;

    event ChapterConfigured(
        uint256 indexed chapterId,
        uint256 indexed seriesId,
        address indexed vrfCollection,
        address publicCollection,
        address ticketHub,
        uint16 saleCap,
        uint16 marketingCap,
        uint16 totalCap
    );
    event PublicUnlockSaleThresholdSet(
        uint256 indexed chapterId,
        uint16 previousThreshold,
        uint16 newThreshold
    );
    event PublicUnlockSaleThresholdLocked(uint256 indexed chapterId, uint16 threshold);

    constructor(address initialOwner, address registry_) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ChapterControllerV2OwnerZero();
        if (registry_ == address(0)) revert ChapterControllerV2ZeroAddress();
        registry = BiggiSeriesRegistry(registry_);
    }

    function controllerVersion() external pure returns (uint256) {
        return 2;
    }

    function configureChapter(
        uint256 chapterId,
        uint256 seriesId,
        address vrfCollection,
        address publicCollection,
        address ticketHub,
        uint16 saleCap_,
        uint16 marketingCap_,
        uint16 totalCap_
    ) external onlyOwner {
        _configureChapter(
            chapterId,
            seriesId,
            vrfCollection,
            publicCollection,
            ticketHub,
            saleCap_,
            marketingCap_,
            totalCap_,
            saleCap_,
            true
        );
    }

    function configureChapterWithUnlockThreshold(
        uint256 chapterId,
        uint256 seriesId,
        address vrfCollection,
        address publicCollection,
        address ticketHub,
        uint16 saleCap_,
        uint16 marketingCap_,
        uint16 totalCap_,
        uint16 unlockSaleThreshold_
    ) external onlyOwner {
        _configureChapter(
            chapterId,
            seriesId,
            vrfCollection,
            publicCollection,
            ticketHub,
            saleCap_,
            marketingCap_,
            totalCap_,
            unlockSaleThreshold_,
            true
        );
    }

    function stageChapterWithUnlockThreshold(
        uint256 chapterId,
        uint256 seriesId,
        address vrfCollection,
        address publicCollection,
        address ticketHub,
        uint16 saleCap_,
        uint16 marketingCap_,
        uint16 totalCap_,
        uint16 unlockSaleThreshold_
    ) external onlyOwner {
        _configureChapter(
            chapterId,
            seriesId,
            vrfCollection,
            publicCollection,
            ticketHub,
            saleCap_,
            marketingCap_,
            totalCap_,
            unlockSaleThreshold_,
            false
        );
    }

    function setPublicUnlockSaleThreshold(uint256 chapterId, uint16 threshold) external onlyOwner {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerV2InvalidChapter();
        _setPublicUnlockSaleThreshold(chapterId, cfg.saleCap, threshold);
    }

    function lockPublicUnlockSaleThreshold(uint256 chapterId) external onlyOwner {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerV2InvalidChapter();
        uint16 threshold = publicUnlockSaleThreshold[chapterId];
        if (threshold == 0) revert ChapterControllerV2InvalidUnlockThreshold();
        if (publicUnlockThresholdLocked[chapterId]) return;
        publicUnlockThresholdLocked[chapterId] = true;
        emit PublicUnlockSaleThresholdLocked(chapterId, threshold);
    }

    function getChapterPriceProvider(uint256 chapterId) external view returns (address) {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerV2InvalidChapter();
        (address vrfCollection, , ) = registry.getChapterCollections(chapterId);
        if (!_isChapterStackConsistent(chapterId, vrfCollection)) revert ChapterControllerV2StackMismatch();
        return vrfCollection;
    }

    function getChapterCollections(uint256 chapterId)
        external
        view
        returns (address vrfCollection, address publicCollection, address ticketHub)
    {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerV2InvalidChapter();
        return registry.getChapterCollections(chapterId);
    }

    function isPublicMintUnlocked(uint256 chapterId) public view returns (bool) {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerV2InvalidChapter();

        (address vrfCollection, , address ticketHub) = registry.getChapterCollections(chapterId);
        if (!_isChapterStackConsistent(chapterId, vrfCollection)) return false;
        if (!_doHubCapsMatch(chapterId, ticketHub, cfg.saleCap, cfg.marketingCap, cfg.totalCap)) return false;

        (bool ok, uint256 saleMinted_, , ) = _readHubMintProgress(chapterId, ticketHub);
        uint16 threshold = publicUnlockSaleThreshold[chapterId];
        return ok && threshold != 0 && saleMinted_ >= threshold;
    }

    function chapterMintProgress(uint256 chapterId)
        external
        view
        returns (
            uint256 saleMinted_,
            uint256 marketingMinted_,
            uint256 totalMinted_,
            uint256 saleCap_,
            uint256 marketingCap_,
            uint256 totalCap_,
            bool publicUnlocked
        )
    {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerV2InvalidChapter();
        (address vrfCollection, , address ticketHub) = registry.getChapterCollections(chapterId);
        (bool ok, uint256 saleMintedValue, uint256 marketingMintedValue, uint256 totalMintedValue) =
            _readHubMintProgress(chapterId, ticketHub);

        saleMinted_ = ok ? saleMintedValue : 0;
        marketingMinted_ = ok ? marketingMintedValue : 0;
        totalMinted_ = ok ? totalMintedValue : 0;
        saleCap_ = cfg.saleCap;
        marketingCap_ = cfg.marketingCap;
        totalCap_ = cfg.totalCap;

        uint16 threshold = publicUnlockSaleThreshold[chapterId];
        publicUnlocked =
            ok &&
            threshold != 0 &&
            _isChapterStackConsistent(chapterId, vrfCollection) &&
            _doHubCapsMatch(chapterId, ticketHub, cfg.saleCap, cfg.marketingCap, cfg.totalCap) &&
            saleMinted_ >= threshold;
    }

    function publicUnlockProgress(uint256 chapterId)
        external
        view
        returns (
            uint256 saleMinted_,
            uint256 unlockSaleThreshold_,
            bool thresholdLocked,
            bool capsConsistent,
            bool stackConsistent,
            bool publicUnlocked
        )
    {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerV2InvalidChapter();
        (address vrfCollection, , address ticketHub) = registry.getChapterCollections(chapterId);
        (bool ok, uint256 saleMintedValue, , ) = _readHubMintProgress(chapterId, ticketHub);

        saleMinted_ = ok ? saleMintedValue : 0;
        unlockSaleThreshold_ = publicUnlockSaleThreshold[chapterId];
        thresholdLocked = publicUnlockThresholdLocked[chapterId];
        capsConsistent = _doHubCapsMatch(chapterId, ticketHub, cfg.saleCap, cfg.marketingCap, cfg.totalCap);
        stackConsistent = _isChapterStackConsistent(chapterId, vrfCollection);
        publicUnlocked =
            ok &&
            unlockSaleThreshold_ != 0 &&
            capsConsistent &&
            stackConsistent &&
            saleMinted_ >= unlockSaleThreshold_;
    }

    function isChapterStackConsistent(uint256 chapterId) external view returns (bool) {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerV2InvalidChapter();
        (address vrfCollection, , ) = registry.getChapterCollections(chapterId);
        return _isChapterStackConsistent(chapterId, vrfCollection);
    }

    function isChapterCapConsistent(uint256 chapterId) external view returns (bool) {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerV2InvalidChapter();
        (, , address ticketHub) = registry.getChapterCollections(chapterId);
        return _doHubCapsMatch(chapterId, ticketHub, cfg.saleCap, cfg.marketingCap, cfg.totalCap);
    }

    function _configureChapter(
        uint256 chapterId,
        uint256 seriesId,
        address vrfCollection,
        address publicCollection,
        address ticketHub,
        uint16 saleCap_,
        uint16 marketingCap_,
        uint16 totalCap_,
        uint16 unlockSaleThreshold_,
        bool requireCurrentHubCaps
    ) internal {
        if (vrfCollection == address(0) || publicCollection == address(0) || ticketHub == address(0)) {
            revert ChapterControllerV2ZeroAddress();
        }
        if (uint256(saleCap_) + uint256(marketingCap_) != uint256(totalCap_)) {
            revert ChapterControllerV2CapMismatch();
        }
        if (unlockSaleThreshold_ == 0 || unlockSaleThreshold_ > saleCap_) {
            revert ChapterControllerV2InvalidUnlockThreshold();
        }

        (uint256 regSeriesId, ) = registry.getChapterMeta(chapterId);
        (address regVrf, address regPublic, address regTicketHub) = registry.getChapterCollections(chapterId);
        if (
            regSeriesId != seriesId ||
            regVrf != vrfCollection ||
            regPublic != publicCollection ||
            regTicketHub != ticketHub
        ) {
            revert ChapterControllerV2RegistryMismatch();
        }
        if (!_isDirectStackBound(chapterId, vrfCollection, ticketHub)) {
            revert ChapterControllerV2StackMismatch();
        }
        if (
            requireCurrentHubCaps &&
            !_doHubCapsMatch(chapterId, ticketHub, saleCap_, marketingCap_, totalCap_)
        ) {
            revert ChapterControllerV2HubCapsMismatch();
        }

        if (
            publicUnlockThresholdLocked[chapterId] &&
            publicUnlockSaleThreshold[chapterId] != unlockSaleThreshold_
        ) {
            revert ChapterControllerV2UnlockThresholdLocked();
        }

        chapterConfig[chapterId] = ChapterConfig({
            exists: true,
            saleCap: saleCap_,
            marketingCap: marketingCap_,
            totalCap: totalCap_
        });
        _setPublicUnlockSaleThreshold(chapterId, saleCap_, unlockSaleThreshold_);

        emit ChapterConfigured(
            chapterId,
            seriesId,
            vrfCollection,
            publicCollection,
            ticketHub,
            saleCap_,
            marketingCap_,
            totalCap_
        );
    }

    function _setPublicUnlockSaleThreshold(uint256 chapterId, uint16 saleCap_, uint16 threshold) internal {
        if (threshold == 0 || threshold > saleCap_) revert ChapterControllerV2InvalidUnlockThreshold();
        uint16 previous = publicUnlockSaleThreshold[chapterId];
        if (publicUnlockThresholdLocked[chapterId] && previous != threshold) {
            revert ChapterControllerV2UnlockThresholdLocked();
        }
        if (previous == threshold) return;
        publicUnlockSaleThreshold[chapterId] = threshold;
        emit PublicUnlockSaleThresholdSet(chapterId, previous, threshold);
    }

    function _isChapterStackConsistent(uint256 chapterId, address vrfCollection) internal view returns (bool) {
        (, , address ticketHub) = registry.getChapterCollections(chapterId);
        return _isDirectStackBound(chapterId, vrfCollection, ticketHub);
    }

    function _isDirectStackBound(uint256 chapterId, address vrfCollection, address ticketHub)
        internal
        view
        returns (bool)
    {
        (bool okMain, address configuredMain) = _readHubMainCollection(chapterId, ticketHub);
        if (!okMain || configuredMain != vrfCollection) return false;

        try IBiggiMainChapterViewV2(vrfCollection).ticketHub() returns (address configuredHub) {
            return configuredHub == ticketHub;
        } catch {
            return false;
        }
    }

    function _doHubCapsMatch(
        uint256 chapterId,
        address ticketHub,
        uint16 saleCap_,
        uint16 marketingCap_,
        uint16 totalCap_
    ) internal view returns (bool) {
        (bool ok, uint16 hubSaleCap, uint16 hubMarketingCap, uint16 hubTotalCap) =
            _readHubCaps(chapterId, ticketHub);
        return
            ok &&
            hubSaleCap == saleCap_ &&
            hubMarketingCap == marketingCap_ &&
            hubTotalCap == totalCap_;
    }

    function _readHubMintProgress(uint256 chapterId, address ticketHub)
        internal
        view
        returns (bool ok, uint256 saleMinted_, uint256 marketingMinted_, uint256 totalMinted_)
    {
        try IBiggiTicketHubChapterViewV2(ticketHub).chapterSaleMinted(chapterId) returns (uint16 value) {
            saleMinted_ = value;
        } catch {
            if (chapterId != 1) return (false, 0, 0, 0);
            try IBiggiTicketHubChapterViewV2(ticketHub).saleMinted() returns (uint16 value) {
                saleMinted_ = value;
            } catch {
                return (false, 0, 0, 0);
            }
        }

        try IBiggiTicketHubChapterViewV2(ticketHub).chapterMarketingMinted(chapterId) returns (uint16 value) {
            marketingMinted_ = value;
        } catch {
            if (chapterId != 1) return (false, 0, 0, 0);
            try IBiggiTicketHubChapterViewV2(ticketHub).marketingMinted() returns (uint16 value) {
                marketingMinted_ = value;
            } catch {
                return (false, 0, 0, 0);
            }
        }

        try IBiggiTicketHubChapterViewV2(ticketHub).chapterTotalMinted(chapterId) returns (uint256 value) {
            totalMinted_ = value;
        } catch {
            if (chapterId != 1) return (false, 0, 0, 0);
            try IBiggiTicketHubChapterViewV2(ticketHub).totalMinted() returns (uint256 value) {
                totalMinted_ = value;
            } catch {
                return (false, 0, 0, 0);
            }
        }
        return (true, saleMinted_, marketingMinted_, totalMinted_);
    }

    function _readHubMainCollection(uint256 chapterId, address ticketHub)
        internal
        view
        returns (bool ok, address configuredMain)
    {
        try IBiggiTicketHubChapterViewV2(ticketHub).chapterMainCollection(chapterId) returns (address value) {
            return (true, value);
        } catch {
            if (chapterId != 1) return (false, address(0));
            try IBiggiTicketHubChapterViewV2(ticketHub).mainCollection() returns (address value) {
                return (true, value);
            } catch {
                return (false, address(0));
            }
        }
    }

    function _readHubCaps(uint256 chapterId, address ticketHub)
        internal
        view
        returns (bool ok, uint16 hubSaleCap, uint16 hubMarketingCap, uint16 hubTotalCap)
    {
        try IBiggiTicketHubChapterViewV2(ticketHub).chapterSaleCap(chapterId) returns (uint16 value) {
            hubSaleCap = value;
        } catch {
            if (chapterId != 1) return (false, 0, 0, 0);
            try IBiggiTicketHubChapterViewV2(ticketHub).saleCap() returns (uint16 value) {
                hubSaleCap = value;
            } catch {
                return (false, 0, 0, 0);
            }
        }

        try IBiggiTicketHubChapterViewV2(ticketHub).chapterMarketingCap(chapterId) returns (uint16 value) {
            hubMarketingCap = value;
        } catch {
            if (chapterId != 1) return (false, 0, 0, 0);
            try IBiggiTicketHubChapterViewV2(ticketHub).marketingCap() returns (uint16 value) {
                hubMarketingCap = value;
            } catch {
                return (false, 0, 0, 0);
            }
        }

        try IBiggiTicketHubChapterViewV2(ticketHub).chapterTotalCap(chapterId) returns (uint16 value) {
            hubTotalCap = value;
        } catch {
            if (chapterId != 1) return (false, 0, 0, 0);
            try IBiggiTicketHubChapterViewV2(ticketHub).totalCap() returns (uint16 value) {
                hubTotalCap = value;
            } catch {
                return (false, 0, 0, 0);
            }
        }
        return (true, hubSaleCap, hubMarketingCap, hubTotalCap);
    }
}
