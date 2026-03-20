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
}

error ChapterControllerOwnerZero();
error ChapterControllerInvalidChapter();
error ChapterControllerZeroAddress();
error ChapterControllerCapMismatch();
error ChapterControllerRegistryMismatch();

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

        (, , address ticketHub) = registry.getChapterCollections(chapterId);
        IBiggiTicketHubChapterView hub = IBiggiTicketHubChapterView(ticketHub);
        return
            hub.saleMinted() == cfg.saleCap &&
            hub.marketingMinted() == cfg.marketingCap &&
            hub.totalMinted() == cfg.totalCap;
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
        (, , address ticketHub) = registry.getChapterCollections(chapterId);
        IBiggiTicketHubChapterView hub = IBiggiTicketHubChapterView(ticketHub);
        saleMinted_ = hub.saleMinted();
        marketingMinted_ = hub.marketingMinted();
        totalMinted_ = hub.totalMinted();
        saleCap_ = cfg.saleCap;
        marketingCap_ = cfg.marketingCap;
        totalCap_ = cfg.totalCap;
        publicUnlocked = saleMinted_ == saleCap_ && marketingMinted_ == marketingCap_ && totalMinted_ == totalCap_;
    }
}
