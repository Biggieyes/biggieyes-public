// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BiggiIDHelper2
 * @dev Pomocná knihovna pro práci s indexy a ID v kolekci BiggiEyes.
 *      Kompatibilní s hlavním kontraktem BIGGIEYES3 (ID = 1 až 550 main NFT, 551+ pro rewards, 561+ character)
 */
library BiggiIDHelper2 {
    uint256 internal constant TICKET_OFFSET = 1;  // přidaná konstanta pro vstupenky
    uint256 internal constant BIGGI_OFFSET = 1001;
    uint256 internal constant REWARDS_OFFSET = 551;
    uint256 internal constant CHARACTER_OFFSET = 561;
    uint256 internal constant MAX_SUPPLY = 550;

    // Vrací, zda jde o ticket (vstupenku)
    function isTicket(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= TICKET_OFFSET && tokenId < BIGGI_OFFSET;
    }

    // Vrací, zda jde o main NFT (1001 až 1550)
    function isMainNft(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= BIGGI_OFFSET && tokenId < REWARDS_OFFSET;
    }

    // Vrací, zda jde o rewards NFT (551 až 560)
    function isRewardNft(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= REWARDS_OFFSET && tokenId < CHARACTER_OFFSET;
    }

    // Vrací, zda jde o character NFT (561 až 570)
    function isCharacterNft(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= CHARACTER_OFFSET && tokenId < CHARACTER_OFFSET + 10;
    }

    // Převod tokenId na index v mappingu nftInfo (začíná od 1)
    function nftIndexFromTokenId(uint256 tokenId) internal pure returns (uint256) {
        require(isMainNft(tokenId), "Not a main NFT");
        return tokenId - BIGGI_OFFSET + 1;
    }

    // Převod indexu v nftInfo na tokenId (začíná od 1)
    function tokenIdFromNftIndex(uint256 idx) internal pure returns (uint256) {
        require(idx >= 1 && idx <= MAX_SUPPLY, "Index out of range");
        return BIGGI_OFFSET + idx - 1;
    }

    // Pomocník pro VRF: převod random čísla na index (1–550, nikdy 0!)
    function randomToMintIndex(uint256 random, uint256 totalSupply) internal pure returns (uint256) {
        require(totalSupply > 0 && totalSupply <= MAX_SUPPLY, "Bad supply");
        return (random % MAX_SUPPLY) + 1;
    }

    // Typ tokenu (pro rozšíření, nemusíš používat, je to jen pro reference)
    enum BiggiTokenType { Ticket, Main, Reward, Character, Unknown }
    function getTokenType(uint256 tokenId) internal pure returns (BiggiTokenType) {
        if (isTicket(tokenId)) return BiggiTokenType.Ticket;
        if (isMainNft(tokenId)) return BiggiTokenType.Main;
        if (isRewardNft(tokenId)) return BiggiTokenType.Reward;
        if (isCharacterNft(tokenId)) return BiggiTokenType.Character;
        return BiggiTokenType.Unknown;
    }

    // Můžeš přidat další vlastní helpers
}
