// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiMainReader - konzistentní view agregátor pro VRF main vrstvu.
 *
 * Důležité:
 * - VRF kolekce (BiggiMain) už po refactoru NEd rží ticket sale stav.
 * - Ticket statistiky proto čteme z BiggiTicketHub.
 * - Collection reward counters čteme z BiggiCollectionRewards.
 */

import "../CORE_LIBRARY/BiggiIdIndexLib.sol";

interface IBiggiMainMinimal {
    function exists(uint256 tokenId) external view returns (bool);
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function getCurrentBlockPrice(uint16 blockIdx) external view returns (uint256);
    function getMintData(uint256 index) external view returns (uint256, uint256, uint256);
    function biggiMinted() external view returns (uint16);
    function blockMintCounts(uint256 i) external view returns (uint16);
    function backgroundMintCounts(uint256 i) external view returns (uint16);
    function characterClaimed(uint16 blk) external view returns (bool);
}

interface IBiggiTicketHubReaderView {
    function ticketPrice() external view returns (uint256);
    function ticketMinted() external view returns (uint16);
    function exists(uint256 tokenId) external view returns (bool);
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IBiggiTicketHubFrontendView {
    function BIGGI() external view returns (address);
    function distributor() external view returns (address);
    function tokenSink() external view returns (address);
    function tokenSinkBps() external view returns (uint256);
    function tokenSinkDepositMode() external view returns (bool);
    function biggiPerEth() external view returns (uint256);
    function reserveAddress() external view returns (address);
    function ticketPrice() external view returns (uint256);
    function ticketMinted() external view returns (uint16);
    function saleMinted() external view returns (uint16);
    function marketingMinted() external view returns (uint16);
    function saleCap() external view returns (uint16);
    function marketingCap() external view returns (uint16);
    function MAX_TICKETS() external view returns (uint16);
    function MAX_PER_WALLET() external view returns (uint16);
    function ticketCount(address user) external view returns (uint256);
    function isFullyExhausted() external view returns (bool);
    function paused() external view returns (bool);
}

interface IBiggiCollectionRewardsReaderView {
    function defaultMain() external view returns (address);
    function orangeWinnersCount(address collection) external view returns (uint8);
    function blockWinnersCount(address collection) external view returns (uint8);
    function rainbowRewardClaimedGlobal(address collection) external view returns (bool);
}

interface IBiggiTreasuryAllowlistReaderView {
    function ecosystemBiggiCallers(address caller) external view returns (bool);
}

contract BiggiMainReader {
    using BiggiIdIndexLib for uint256;

    struct TicketHubFrontendSnapshot {
        address ticketHub;
        address biggi;
        address distributor;
        address tokenSink;
        address reserveAddress;
        uint256 tokenSinkBps;
        bool tokenSinkDepositMode;
        bool treasuryAllowsTicketHub;
        bool ecosystemTreasuryRouteOk;
        uint256 ticketPriceWei;
        uint256 ticketPriceBiggi;
        uint16 ticketMinted;
        uint16 saleMinted;
        uint16 marketingMinted;
        uint16 saleCap;
        uint16 marketingCap;
        uint16 maxTickets;
        uint16 maxPerWallet;
        uint256 userTicketCount;
        bool fullyExhausted;
        bool paused;
    }

    IBiggiMainMinimal public immutable main;
    address public immutable ticketHub;
    address public immutable collectionRewards;

    constructor(address mainContract, address ticketHub_, address collectionRewards_) {
        require(mainContract != address(0), "main=0");
        main = IBiggiMainMinimal(mainContract);
        ticketHub = ticketHub_;
        collectionRewards = collectionRewards_;
    }

    function getAllBlockPrices() external view returns (uint256[10] memory prices) {
        for (uint256 i = 0; i < 10; i++) {
            prices[i] = main.getCurrentBlockPrice(uint16(i + 1));
        }
    }

    function getAllBlockMintCounts() external view returns (uint16[10] memory counts) {
        for (uint256 i = 0; i < 10; i++) {
            counts[i] = main.blockMintCounts(i);
        }
    }

    function getAllBackgroundMintCounts() external view returns (uint16[10] memory counts) {
        for (uint256 i = 0; i < 10; i++) {
            counts[i] = main.backgroundMintCounts(i);
        }
    }

    function getMintDataByTokenId(uint256 tokenId)
        external
        view
        returns (uint256 ticketPrice_, uint256 blockPrice_, uint256 finalPrice_)
    {
        if (!main.exists(tokenId)) return (0, 0, 0);
        if (tokenId < BiggiIdIndexLib.BIGGI_OFFSET || tokenId >= BiggiIdIndexLib.CHARACTER_OFFSET) {
            return (0, 0, 0);
        }
        uint256 idx = BiggiIdIndexLib.nftIndexFromTokenId(tokenId);
        return main.getMintData(idx);
    }

    function _rewardCounters() internal view returns (uint8 orange, uint8 blockWinners, bool rainbow) {
        if (collectionRewards == address(0)) return (0, 0, false);
        try IBiggiCollectionRewardsReaderView(collectionRewards).orangeWinnersCount(address(main)) returns (uint8 v) {
            orange = v;
        } catch {}
        try IBiggiCollectionRewardsReaderView(collectionRewards).blockWinnersCount(address(main)) returns (uint8 v) {
            blockWinners = v;
        } catch {}
        try IBiggiCollectionRewardsReaderView(collectionRewards).rainbowRewardClaimedGlobal(address(main)) returns (bool v) {
            rainbow = v;
        } catch {}
    }

    function getRewardsCounters()
        external
        view
        returns (uint8 orange, uint8 blockWinners, bool rainbow, uint8 charactersMinted)
    {
        (orange, blockWinners, rainbow) = _rewardCounters();
        uint8 c;
        for (uint16 i = 1; i <= 10; i++) {
            if (main.characterClaimed(i)) {
                unchecked { c++; }
            }
        }
        charactersMinted = c;
    }

    function getFrontendSnapshot()
        external
        view
        returns (
            uint256 ticketPriceWei,
            uint16 ticketMinted_,
            uint16 biggiMinted_,
            uint256[10] memory currentBlockPrices,
            uint16[10] memory blocksMinted,
            uint16[10] memory bgsMinted,
            uint8 orange_,
            uint8 blockWinners_,
            bool rainbow_,
            uint8 charactersMinted_
        )
    {
        if (ticketHub != address(0)) {
            try IBiggiTicketHubReaderView(ticketHub).ticketPrice() returns (uint256 v) { ticketPriceWei = v; } catch {}
            try IBiggiTicketHubReaderView(ticketHub).ticketMinted() returns (uint16 v) { ticketMinted_ = v; } catch {}
        }
        biggiMinted_ = main.biggiMinted();

        for (uint256 i = 0; i < 10; i++) {
            currentBlockPrices[i] = main.getCurrentBlockPrice(uint16(i + 1));
            blocksMinted[i] = main.blockMintCounts(i);
            bgsMinted[i] = main.backgroundMintCounts(i);
        }

        (orange_, blockWinners_, rainbow_) = _rewardCounters();

        uint8 c;
        for (uint16 j = 1; j <= 10; j++) {
            if (main.characterClaimed(j)) {
                unchecked { c++; }
            }
        }
        charactersMinted_ = c;
    }

    function findTicket(address owner) external view returns (uint256[] memory out) {
        if (ticketHub == address(0)) return out;
        uint256 minted;
        try IBiggiTicketHubReaderView(ticketHub).ticketMinted() returns (uint16 v) {
            minted = uint256(v);
        } catch {
            return out;
        }
        if (minted == 0) return out;

        uint256[] memory buf = new uint256[](minted);
        uint256 found;
        for (uint256 i = 0; i < minted; i++) {
            uint256 tokenId = BiggiIdIndexLib.TICKET_OFFSET + i;
            // Some ticket hub variants do not expose exists(tokenId); ownerOf is enough.
            try IBiggiTicketHubReaderView(ticketHub).ownerOf(tokenId) returns (address o) {
                if (o == owner) {
                    buf[found] = tokenId;
                    unchecked { found++; }
                }
            } catch {}
        }
        out = new uint256[](found);
        for (uint256 j = 0; j < found; j++) out[j] = buf[j];
    }

    function getTicketHubFrontendSnapshot(address user, address treasury)
        external
        view
        returns (TicketHubFrontendSnapshot memory s)
    {
        s.ticketHub = ticketHub;
        if (ticketHub == address(0)) return s;

        IBiggiTicketHubFrontendView h = IBiggiTicketHubFrontendView(ticketHub);
        try h.BIGGI() returns (address v) { s.biggi = v; } catch {}
        try h.distributor() returns (address v) { s.distributor = v; } catch {}
        try h.tokenSink() returns (address v) { s.tokenSink = v; } catch {}
        try h.reserveAddress() returns (address v) { s.reserveAddress = v; } catch {}
        try h.tokenSinkBps() returns (uint256 v) { s.tokenSinkBps = v; } catch {}
        try h.tokenSinkDepositMode() returns (bool v) { s.tokenSinkDepositMode = v; } catch {}
        try h.ticketPrice() returns (uint256 v) { s.ticketPriceWei = v; } catch {}
        try h.biggiPerEth() returns (uint256 v) {
            if (s.ticketPriceWei != 0) {
                s.ticketPriceBiggi = (s.ticketPriceWei * v) / 1 ether;
            }
        } catch {}
        try h.ticketMinted() returns (uint16 v) { s.ticketMinted = v; } catch {}
        try h.saleMinted() returns (uint16 v) { s.saleMinted = v; } catch {}
        try h.marketingMinted() returns (uint16 v) { s.marketingMinted = v; } catch {}
        try h.saleCap() returns (uint16 v) { s.saleCap = v; } catch {}
        try h.marketingCap() returns (uint16 v) { s.marketingCap = v; } catch {}
        try h.MAX_TICKETS() returns (uint16 v) { s.maxTickets = v; } catch {}
        try h.MAX_PER_WALLET() returns (uint16 v) { s.maxPerWallet = v; } catch {}
        if (user != address(0)) {
            try h.ticketCount(user) returns (uint256 v) { s.userTicketCount = v; } catch {}
        }
        try h.isFullyExhausted() returns (bool v) { s.fullyExhausted = v; } catch {}
        try h.paused() returns (bool v) { s.paused = v; } catch {}

        if (treasury != address(0)) {
            try IBiggiTreasuryAllowlistReaderView(treasury).ecosystemBiggiCallers(ticketHub) returns (bool allowed) {
                s.treasuryAllowsTicketHub = allowed;
            } catch {}
        }
        s.ecosystemTreasuryRouteOk =
            s.biggi != address(0) &&
            treasury != address(0) &&
            s.tokenSink == treasury &&
            s.tokenSinkBps == 10_000 &&
            s.tokenSinkDepositMode &&
            s.treasuryAllowsTicketHub;
    }
}
