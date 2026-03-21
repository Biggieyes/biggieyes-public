// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

error OwnerZero();
error InvalidSeries();
error InvalidChapter();
error AlreadyExists();
error ZeroAddress();
error CollectionAssignedToOtherChapter();

contract BiggiSeriesRegistry is Ownable {
    struct SeriesInfo {
        bool exists;
        string name;
        uint256 chapterCount;
    }

    struct ChapterInfo {
        bool exists;
        uint256 seriesId;
        uint256 chapterNumber;
        address vrfCollection;
        address publicCollection;
        address ticketHub;
        bool tokenRewardsEligibleVRF;
        bool tokenRewardsEligiblePublic;
        bool collectionRewardsEligibleVRF;
    }

    uint256 public seriesCount;
    uint256 public chapterCount;

    mapping(uint256 => SeriesInfo) public seriesInfo;
    mapping(uint256 => ChapterInfo) public chapterInfo;
    mapping(address => uint256) public chapterByCollection;

    event SeriesCreated(uint256 indexed seriesId, string name);
    event ChapterCreated(uint256 indexed chapterId, uint256 indexed seriesId, uint256 chapterNumber);
    event ChapterCollectionsSet(uint256 indexed chapterId, address indexed vrfCollection, address indexed publicCollection, address ticketHub);
    event RewardsEligibilitySet(uint256 indexed chapterId, bool tokenRewardsVRF, bool tokenRewardsPublic, bool collectionRewardsVRF);

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert OwnerZero();
    }

    function createSeries(string calldata name) external onlyOwner returns (uint256 seriesId) {
        seriesId = ++seriesCount;
        seriesInfo[seriesId] = SeriesInfo({exists: true, name: name, chapterCount: 0});
        emit SeriesCreated(seriesId, name);
    }

    function createChapter(uint256 seriesId) external onlyOwner returns (uint256 chapterId) {
        if (!seriesInfo[seriesId].exists) revert InvalidSeries();
        chapterId = ++chapterCount;
        uint256 chapterNumber = ++seriesInfo[seriesId].chapterCount;
        chapterInfo[chapterId] = ChapterInfo({
            exists: true,
            seriesId: seriesId,
            chapterNumber: chapterNumber,
            vrfCollection: address(0),
            publicCollection: address(0),
            ticketHub: address(0),
            tokenRewardsEligibleVRF: true,
            tokenRewardsEligiblePublic: true,
            collectionRewardsEligibleVRF: true
        });
        emit ChapterCreated(chapterId, seriesId, chapterNumber);
        emit RewardsEligibilitySet(chapterId, true, true, true);
    }

    function setChapterCollections(
        uint256 chapterId,
        address vrfCollection,
        address publicCollection,
        address ticketHub
    ) external onlyOwner {
        ChapterInfo storage ch = chapterInfo[chapterId];
        if (!ch.exists) revert InvalidChapter();
        if (vrfCollection == address(0) || publicCollection == address(0) || ticketHub == address(0)) revert ZeroAddress();

        uint256 mappedVrf = chapterByCollection[vrfCollection];
        if (mappedVrf != 0 && mappedVrf != chapterId) revert CollectionAssignedToOtherChapter();
        uint256 mappedPublic = chapterByCollection[publicCollection];
        if (mappedPublic != 0 && mappedPublic != chapterId) revert CollectionAssignedToOtherChapter();
        uint256 mappedHub = chapterByCollection[ticketHub];
        if (mappedHub != 0 && mappedHub != chapterId) revert CollectionAssignedToOtherChapter();

        if (ch.vrfCollection != address(0)) chapterByCollection[ch.vrfCollection] = 0;
        if (ch.publicCollection != address(0)) chapterByCollection[ch.publicCollection] = 0;
        if (ch.ticketHub != address(0)) chapterByCollection[ch.ticketHub] = 0;

        ch.vrfCollection = vrfCollection;
        ch.publicCollection = publicCollection;
        ch.ticketHub = ticketHub;

        chapterByCollection[vrfCollection] = chapterId;
        chapterByCollection[publicCollection] = chapterId;
        chapterByCollection[ticketHub] = chapterId;

        emit ChapterCollectionsSet(chapterId, vrfCollection, publicCollection, ticketHub);
    }

    function setRewardsEligibility(
        uint256 chapterId,
        bool tokenRewardsVRF,
        bool tokenRewardsPublic,
        bool collectionRewardsVRF
    ) external onlyOwner {
        ChapterInfo storage ch = chapterInfo[chapterId];
        if (!ch.exists) revert InvalidChapter();
        ch.tokenRewardsEligibleVRF = tokenRewardsVRF;
        ch.tokenRewardsEligiblePublic = tokenRewardsPublic;
        ch.collectionRewardsEligibleVRF = collectionRewardsVRF;
        emit RewardsEligibilitySet(chapterId, tokenRewardsVRF, tokenRewardsPublic, collectionRewardsVRF);
    }

    function getChapterCollections(uint256 chapterId) external view returns (address vrfCollection, address publicCollection, address ticketHub) {
        ChapterInfo storage ch = chapterInfo[chapterId];
        if (!ch.exists) revert InvalidChapter();
        return (ch.vrfCollection, ch.publicCollection, ch.ticketHub);
    }

    function getChapterMeta(uint256 chapterId) external view returns (uint256 seriesId, uint256 chapterNumber) {
        ChapterInfo storage ch = chapterInfo[chapterId];
        if (!ch.exists) revert InvalidChapter();
        return (ch.seriesId, ch.chapterNumber);
    }

    function isTokenRewardsCollection(address collection) external view returns (bool) {
        uint256 chapterId = chapterByCollection[collection];
        if (chapterId == 0) return false;
        ChapterInfo storage ch = chapterInfo[chapterId];
        if (collection == ch.vrfCollection) return ch.tokenRewardsEligibleVRF;
        if (collection == ch.publicCollection) return ch.tokenRewardsEligiblePublic;
        return false;
    }

    function isCollectionRewardsCollection(address collection) external view returns (bool) {
        uint256 chapterId = chapterByCollection[collection];
        if (chapterId == 0) return false;
        ChapterInfo storage ch = chapterInfo[chapterId];
        return collection == ch.vrfCollection && ch.collectionRewardsEligibleVRF;
    }
}
