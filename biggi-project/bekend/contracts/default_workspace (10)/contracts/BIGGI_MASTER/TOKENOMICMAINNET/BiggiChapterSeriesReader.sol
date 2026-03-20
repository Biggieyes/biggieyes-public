// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBiggiChapterControllerReaderView {
    function registry() external view returns (address);
    function chapterConfig(uint256 chapterId) external view returns (bool exists, uint16 saleCap, uint16 marketingCap, uint16 totalCap);
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
        );
    function getChapterPriceProvider(uint256 chapterId) external view returns (address);
}

interface IBiggiSeriesRegistryReaderView {
    function seriesCount() external view returns (uint256);
    function chapterCount() external view returns (uint256);
    function seriesInfo(uint256 seriesId) external view returns (bool exists, string memory name, uint256 chapterCount_);
    function chapterInfo(uint256 chapterId)
        external
        view
        returns (
            bool exists,
            uint256 seriesId,
            uint256 chapterNumber,
            address vrfCollection,
            address publicCollection,
            address ticketHub,
            bool tokenRewardsEligibleVRF,
            bool tokenRewardsEligiblePublic,
            bool collectionRewardsEligibleVRF
        );
    function chapterByCollection(address collection) external view returns (uint256);
    function isTokenRewardsCollection(address collection) external view returns (bool);
    function isCollectionRewardsCollection(address collection) external view returns (bool);
}

contract BiggiChapterSeriesReader {
    struct GlobalSnapshot {
        address controller;
        address registry;
        uint256 seriesCount;
        uint256 chapterCount;
        address controllerRegistry;
        bool controllerMatchesRegistry;
    }

    struct SeriesSnapshot {
        uint256 seriesId;
        bool exists;
        string name;
        uint256 chapterCount;
    }

    struct ChapterSnapshot {
        uint256 chapterId;
        bool configured;
        bool chapterExists;
        uint256 seriesId;
        uint256 chapterNumber;
        address vrfCollection;
        address publicCollection;
        address ticketHub;
        uint16 saleCap;
        uint16 marketingCap;
        uint16 totalCap;
        uint256 saleMinted;
        uint256 marketingMinted;
        uint256 totalMinted;
        bool publicUnlocked;
        address priceProvider;
        bool tokenRewardsEligibleVRF;
        bool tokenRewardsEligiblePublic;
        bool collectionRewardsEligibleVRF;
        bool controllerRegistryMatch;
    }

    struct CollectionSnapshot {
        address collection;
        uint256 chapterId;
        uint256 seriesId;
        uint256 chapterNumber;
        bool tokenRewardsEligible;
        bool collectionRewardsEligible;
        bool isVrfCollection;
        bool isPublicCollection;
        bool isTicketHubCollection;
    }

    IBiggiChapterControllerReaderView public immutable chapterController;
    IBiggiSeriesRegistryReaderView public immutable registry;

    constructor(address chapterController_, address registry_) {
        require(chapterController_ != address(0), "controller=0");
        require(registry_ != address(0), "registry=0");
        chapterController = IBiggiChapterControllerReaderView(chapterController_);
        registry = IBiggiSeriesRegistryReaderView(registry_);
    }

    function globalSnapshot() external view returns (GlobalSnapshot memory s) {
        s.controller = address(chapterController);
        s.registry = address(registry);
        s.seriesCount = registry.seriesCount();
        s.chapterCount = registry.chapterCount();
        s.controllerRegistry = chapterController.registry();
        s.controllerMatchesRegistry = s.controllerRegistry == s.registry;
    }

    function seriesSnapshot(uint256 seriesId) external view returns (SeriesSnapshot memory s) {
        s.seriesId = seriesId;
        (s.exists, s.name, s.chapterCount) = registry.seriesInfo(seriesId);
    }

    function chapterSnapshot(uint256 chapterId) external view returns (ChapterSnapshot memory s) {
        s.chapterId = chapterId;
        (s.configured, s.saleCap, s.marketingCap, s.totalCap) = chapterController.chapterConfig(chapterId);
        s.controllerRegistryMatch = chapterController.registry() == address(registry);

        try registry.chapterInfo(chapterId) returns (
            bool exists_,
            uint256 seriesId_,
            uint256 chapterNumber_,
            address vrfCollection_,
            address publicCollection_,
            address ticketHub_,
            bool tokenRewardsEligibleVRF_,
            bool tokenRewardsEligiblePublic_,
            bool collectionRewardsEligibleVRF_
        ) {
            s.chapterExists = exists_;
            s.seriesId = seriesId_;
            s.chapterNumber = chapterNumber_;
            s.vrfCollection = vrfCollection_;
            s.publicCollection = publicCollection_;
            s.ticketHub = ticketHub_;
            s.tokenRewardsEligibleVRF = tokenRewardsEligibleVRF_;
            s.tokenRewardsEligiblePublic = tokenRewardsEligiblePublic_;
            s.collectionRewardsEligibleVRF = collectionRewardsEligibleVRF_;
        } catch {
            return s;
        }

        if (!s.configured) return s;

        try chapterController.chapterMintProgress(chapterId) returns (
            uint256 saleMinted_,
            uint256 marketingMinted_,
            uint256 totalMinted_,
            uint256,
            uint256,
            uint256,
            bool publicUnlocked_
        ) {
            s.saleMinted = saleMinted_;
            s.marketingMinted = marketingMinted_;
            s.totalMinted = totalMinted_;
            s.publicUnlocked = publicUnlocked_;
        } catch {}

        try chapterController.getChapterPriceProvider(chapterId) returns (address provider) {
            s.priceProvider = provider;
        } catch {}
    }

    function collectionSnapshot(address collection) public view returns (CollectionSnapshot memory s) {
        s.collection = collection;
        s.chapterId = registry.chapterByCollection(collection);
        s.tokenRewardsEligible = registry.isTokenRewardsCollection(collection);
        s.collectionRewardsEligible = registry.isCollectionRewardsCollection(collection);

        if (s.chapterId == 0) return s;

        try registry.chapterInfo(s.chapterId) returns (
            bool,
            uint256 seriesId_,
            uint256 chapterNumber_,
            address vrfCollection_,
            address publicCollection_,
            address ticketHub_,
            bool,
            bool,
            bool
        ) {
            s.seriesId = seriesId_;
            s.chapterNumber = chapterNumber_;
            s.isVrfCollection = collection == vrfCollection_;
            s.isPublicCollection = collection == publicCollection_;
            s.isTicketHubCollection = collection == ticketHub_;
        } catch {}
    }

    function batchCollectionSnapshot(address[] calldata collections)
        external
        view
        returns (CollectionSnapshot[] memory out)
    {
        out = new CollectionSnapshot[](collections.length);
        for (uint256 i = 0; i < collections.length; ++i) {
            out[i] = collectionSnapshot(collections[i]);
        }
    }
}

