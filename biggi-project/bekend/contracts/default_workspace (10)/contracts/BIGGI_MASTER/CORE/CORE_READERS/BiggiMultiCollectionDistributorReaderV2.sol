// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMultiCollectionDistributorView {
    function collectionRewards() external view returns (address);
    function reserve() external view returns (address);
    function buybackAgent() external view returns (address);
    function treasury() external view returns (address);
    function communityCenter() external view returns (address);
    function registry() external view returns (address);

    function collections(address) external view returns (bool);
    function pending(address) external view returns (uint256);
    function totalPending() external view returns (uint256);
    function totalReceived() external view returns (uint256);
    function receivedByCollection(address) external view returns (uint256);
    function receivedBySeries(uint256) external view returns (uint256);
    function receivedByChapter(uint256) external view returns (uint256);
}

interface ISeriesRegistryLite {
    function chapterByCollection(address collection) external view returns (uint256);
    function getChapterMeta(uint256 chapterId) external view returns (uint256 seriesId, uint256 chapterNumber);
}

contract BiggiMultiCollectionDistributorReaderV2 {
    address public immutable distributor;

    constructor(address distributor_) {
        require(distributor_ != address(0), "distributor=0");
        distributor = distributor_;
    }

    function recipients()
        public
        view
        returns (
            address collectionRewards_,
            address reserve_,
            address buybackAgent_,
            address treasury_,
            address communityCenter_,
            address registry_
        )
    {
        IMultiCollectionDistributorView d = IMultiCollectionDistributorView(distributor);
        collectionRewards_ = d.collectionRewards();
        reserve_ = d.reserve();
        buybackAgent_ = d.buybackAgent();
        treasury_ = d.treasury();
        communityCenter_ = d.communityCenter();
        registry_ = d.registry();
    }

    function pendingSnapshot(address recipient)
        external
        view
        returns (uint256 recipientPending, uint256 totalPending_)
    {
        IMultiCollectionDistributorView d = IMultiCollectionDistributorView(distributor);
        recipientPending = d.pending(recipient);
        totalPending_ = d.totalPending();
    }

    function sourceSnapshot(address source)
        public
        view
        returns (
            bool whitelisted,
            uint256 totalForSource,
            uint256 chapterId,
            uint256 chapterNumber,
            uint256 seriesId,
            uint256 totalForChapter,
            uint256 totalForSeries
        )
    {
        IMultiCollectionDistributorView d = IMultiCollectionDistributorView(distributor);
        whitelisted = d.collections(source);
        totalForSource = d.receivedByCollection(source);

        address registryAddr = d.registry();
        if (registryAddr == address(0)) {
            return (whitelisted, totalForSource, 0, 0, 0, 0, 0);
        }

        ISeriesRegistryLite r = ISeriesRegistryLite(registryAddr);
        try r.chapterByCollection(source) returns (uint256 chId) {
            chapterId = chId;
        } catch {
            chapterId = 0;
        }

        if (chapterId == 0) {
            return (whitelisted, totalForSource, 0, 0, 0, 0, 0);
        }

        try r.getChapterMeta(chapterId) returns (uint256 sId, uint256 chNum) {
            seriesId = sId;
            chapterNumber = chNum;
        } catch {
            seriesId = 0;
            chapterNumber = 0;
        }

        totalForChapter = d.receivedByChapter(chapterId);
        if (seriesId != 0) {
            totalForSeries = d.receivedBySeries(seriesId);
        }
    }

    function fullSnapshot(address source, address pendingRecipient)
        external
        view
        returns (
            uint256 totalReceived_,
            uint256 totalPending_,
            uint256 pendingForRecipient,
            bool sourceWhitelisted,
            uint256 sourceReceived,
            uint256 sourceChapterId,
            uint256 sourceChapterNumber,
            uint256 sourceSeriesId,
            uint256 chapterReceived,
            uint256 seriesReceived,
            address collectionRewards_,
            address reserve_,
            address buybackAgent_,
            address treasury_,
            address communityCenter_,
            address registry_
        )
    {
        IMultiCollectionDistributorView d = IMultiCollectionDistributorView(distributor);
        totalReceived_ = d.totalReceived();
        totalPending_ = d.totalPending();
        pendingForRecipient = d.pending(pendingRecipient);

        (
            sourceWhitelisted,
            sourceReceived,
            sourceChapterId,
            sourceChapterNumber,
            sourceSeriesId,
            chapterReceived,
            seriesReceived
        ) = sourceSnapshot(source);

        (
            collectionRewards_,
            reserve_,
            buybackAgent_,
            treasury_,
            communityCenter_,
            registry_
        ) = recipients();
    }
}
