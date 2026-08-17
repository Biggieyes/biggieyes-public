// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./BiggiSeriesRegistry.sol";

interface IBiggiTicketHubChapterView {
    function saleMinted() external view returns (uint16);
    function marketingMinted() external view returns (uint16);
    function saleCap() external view returns (uint16);
    function marketingCap() external view returns (uint16);
    function totalMinted() external view returns (uint256);
    function totalCap() external view returns (uint16);
    function mainCollection() external view returns (address);
    function chapterSaleMinted(uint256 chapterId) external view returns (uint16);
    function chapterMarketingMinted(uint256 chapterId) external view returns (uint16);
    function chapterSaleCap(uint256 chapterId) external view returns (uint16);
    function chapterMarketingCap(uint256 chapterId) external view returns (uint16);
    function chapterTotalMinted(uint256 chapterId) external view returns (uint256);
    function chapterTotalCap(uint256 chapterId) external view returns (uint16);
    function chapterMainCollection(uint256 chapterId) external view returns (address);
}

interface IBiggiMainChapterView {
    function ticketHub() external view returns (address);
}

error ChapterControllerOwnerZero();
error ChapterControllerInvalidChapter();
error ChapterControllerZeroAddress();
error ChapterControllerCapMismatch();
error ChapterControllerRegistryMismatch();
error ChapterControllerStackMismatch();
error ChapterControllerHubCapsMismatch();

contract BiggiChapterController is Ownable {
    struct ChapterConfig {
        bool exists;
        uint16 saleCap;
        uint16 marketingCap;
        uint16 totalCap;
    }

    BiggiSeriesRegistry public immutable registry;
    mapping(uint256 => ChapterConfig) public chapterConfig;

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

    constructor(address initialOwner, address registry_) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ChapterControllerOwnerZero();
        if (registry_ == address(0)) revert ChapterControllerZeroAddress();
        registry = BiggiSeriesRegistry(registry_);
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
        if (vrfCollection == address(0) || publicCollection == address(0) || ticketHub == address(0)) revert ChapterControllerZeroAddress();
        if (uint256(saleCap_) + uint256(marketingCap_) != uint256(totalCap_)) revert ChapterControllerCapMismatch();

        (uint256 regSeriesId, ) = registry.getChapterMeta(chapterId);
        (address regVrf, address regPublic, address regTicketHub) = registry.getChapterCollections(chapterId);
        if (regSeriesId != seriesId || regVrf != vrfCollection || regPublic != publicCollection || regTicketHub != ticketHub) {
            revert ChapterControllerRegistryMismatch();
        }
        if (!_isDirectStackBound(chapterId, vrfCollection, ticketHub)) revert ChapterControllerStackMismatch();
        if (!_doHubCapsMatch(chapterId, ticketHub, saleCap_, marketingCap_, totalCap_)) revert ChapterControllerHubCapsMismatch();

        chapterConfig[chapterId] = ChapterConfig({
            exists: true,
            saleCap: saleCap_,
            marketingCap: marketingCap_,
            totalCap: totalCap_
        });

        emit ChapterConfigured(chapterId, seriesId, vrfCollection, publicCollection, ticketHub, saleCap_, marketingCap_, totalCap_);
    }

    function getChapterPriceProvider(uint256 chapterId) external view returns (address) {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerInvalidChapter();
        (address vrfCollection, , ) = registry.getChapterCollections(chapterId);
        if (!_isChapterStackConsistent(chapterId, vrfCollection)) revert ChapterControllerStackMismatch();
        return vrfCollection;
    }

    function getChapterCollections(uint256 chapterId) external view returns (address vrfCollection, address publicCollection, address ticketHub) {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerInvalidChapter();
        return registry.getChapterCollections(chapterId);
    }

    function isPublicMintUnlocked(uint256 chapterId) public view returns (bool) {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerInvalidChapter();

        (address vrfCollection, , address ticketHub) = registry.getChapterCollections(chapterId);
        if (!_isChapterStackConsistent(chapterId, vrfCollection)) return false;
        if (!_doHubCapsMatch(chapterId, ticketHub, cfg.saleCap, cfg.marketingCap, cfg.totalCap)) return false;
        (bool ok, uint256 saleMinted_, uint256 marketingMinted_, uint256 totalMinted_) = _readHubMintProgress(chapterId, ticketHub);
        if (!ok) return false;
        return
            saleMinted_ == cfg.saleCap &&
            marketingMinted_ == cfg.marketingCap &&
            totalMinted_ == cfg.totalCap;
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
        if (!cfg.exists) revert ChapterControllerInvalidChapter();
        (address vrfCollection, , address ticketHub) = registry.getChapterCollections(chapterId);
        (bool ok, uint256 saleMintedValue, uint256 marketingMintedValue, uint256 totalMintedValue) = _readHubMintProgress(chapterId, ticketHub);
        saleMinted_ = ok ? saleMintedValue : 0;
        marketingMinted_ = ok ? marketingMintedValue : 0;
        totalMinted_ = ok ? totalMintedValue : 0;
        saleCap_ = cfg.saleCap;
        marketingCap_ = cfg.marketingCap;
        totalCap_ = cfg.totalCap;
        publicUnlocked =
            ok &&
            _isChapterStackConsistent(chapterId, vrfCollection) &&
            _doHubCapsMatch(chapterId, ticketHub, cfg.saleCap, cfg.marketingCap, cfg.totalCap) &&
            saleMinted_ == saleCap_ &&
            marketingMinted_ == marketingCap_ &&
            totalMinted_ == totalCap_;
    }

    function isChapterStackConsistent(uint256 chapterId) external view returns (bool) {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerInvalidChapter();
        (address vrfCollection, , ) = registry.getChapterCollections(chapterId);
        return _isChapterStackConsistent(chapterId, vrfCollection);
    }

    function isChapterCapConsistent(uint256 chapterId) external view returns (bool) {
        ChapterConfig storage cfg = chapterConfig[chapterId];
        if (!cfg.exists) revert ChapterControllerInvalidChapter();
        (, , address ticketHub) = registry.getChapterCollections(chapterId);
        return _doHubCapsMatch(chapterId, ticketHub, cfg.saleCap, cfg.marketingCap, cfg.totalCap);
    }

    function _isChapterStackConsistent(uint256 chapterId, address vrfCollection) internal view returns (bool) {
        (, , address ticketHub) = registry.getChapterCollections(chapterId);
        return _isDirectStackBound(chapterId, vrfCollection, ticketHub);
    }

    function _isDirectStackBound(uint256 chapterId, address vrfCollection, address ticketHub) internal view returns (bool) {
        (bool okMain, address configuredMain) = _readHubMainCollection(chapterId, ticketHub);
        if (!okMain || configuredMain != vrfCollection) {
            return false;
        }

        try IBiggiMainChapterView(vrfCollection).ticketHub() returns (address configuredHub) {
            return configuredHub == ticketHub;
        } catch {
            return false;
        }
    }

    function _doHubCapsMatch(uint256 chapterId, address ticketHub, uint16 saleCap_, uint16 marketingCap_, uint16 totalCap_) internal view returns (bool) {
        (bool ok, uint16 hubSaleCap, uint16 hubMarketingCap, uint16 hubTotalCap) = _readHubCaps(chapterId, ticketHub);
        if (!ok) return false;
        return hubSaleCap == saleCap_ && hubMarketingCap == marketingCap_ && hubTotalCap == totalCap_;
    }

    function _readHubMintProgress(uint256 chapterId, address ticketHub)
        internal
        view
        returns (bool ok, uint256 saleMinted_, uint256 marketingMinted_, uint256 totalMinted_)
    {
        try IBiggiTicketHubChapterView(ticketHub).chapterSaleMinted(chapterId) returns (uint16 value) {
            saleMinted_ = value;
        } catch {
            if (chapterId != 1) return (false, 0, 0, 0);
            try IBiggiTicketHubChapterView(ticketHub).saleMinted() returns (uint16 value) {
                saleMinted_ = value;
            } catch {
                return (false, 0, 0, 0);
            }
        }
        try IBiggiTicketHubChapterView(ticketHub).chapterMarketingMinted(chapterId) returns (uint16 value) {
            marketingMinted_ = value;
        } catch {
            if (chapterId != 1) return (false, 0, 0, 0);
            try IBiggiTicketHubChapterView(ticketHub).marketingMinted() returns (uint16 value) {
                marketingMinted_ = value;
            } catch {
                return (false, 0, 0, 0);
            }
        }
        try IBiggiTicketHubChapterView(ticketHub).chapterTotalMinted(chapterId) returns (uint256 value) {
            totalMinted_ = value;
        } catch {
            if (chapterId != 1) return (false, 0, 0, 0);
            try IBiggiTicketHubChapterView(ticketHub).totalMinted() returns (uint256 value) {
                totalMinted_ = value;
            } catch {
                return (false, 0, 0, 0);
            }
        }
        return (true, saleMinted_, marketingMinted_, totalMinted_);
    }

    function _readHubMainCollection(uint256 chapterId, address ticketHub) internal view returns (bool ok, address configuredMain) {
        try IBiggiTicketHubChapterView(ticketHub).chapterMainCollection(chapterId) returns (address value) {
            return (true, value);
        } catch {
            if (chapterId != 1) return (false, address(0));
            try IBiggiTicketHubChapterView(ticketHub).mainCollection() returns (address value) {
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
        try IBiggiTicketHubChapterView(ticketHub).chapterSaleCap(chapterId) returns (uint16 value) {
            hubSaleCap = value;
        } catch {
            if (chapterId != 1) return (false, 0, 0, 0);
            try IBiggiTicketHubChapterView(ticketHub).saleCap() returns (uint16 value) {
                hubSaleCap = value;
            } catch {
                return (false, 0, 0, 0);
            }
        }

        try IBiggiTicketHubChapterView(ticketHub).chapterMarketingCap(chapterId) returns (uint16 value) {
            hubMarketingCap = value;
        } catch {
            if (chapterId != 1) return (false, 0, 0, 0);
            try IBiggiTicketHubChapterView(ticketHub).marketingCap() returns (uint16 value) {
                hubMarketingCap = value;
            } catch {
                return (false, 0, 0, 0);
            }
        }

        try IBiggiTicketHubChapterView(ticketHub).chapterTotalCap(chapterId) returns (uint16 value) {
            hubTotalCap = value;
        } catch {
            if (chapterId != 1) return (false, 0, 0, 0);
            try IBiggiTicketHubChapterView(ticketHub).totalCap() returns (uint16 value) {
                hubTotalCap = value;
            } catch {
                return (false, 0, 0, 0);
            }
        }

        return (true, hubSaleCap, hubMarketingCap, hubTotalCap);
    }
}
