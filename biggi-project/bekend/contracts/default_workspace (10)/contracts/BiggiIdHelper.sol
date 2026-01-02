// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BiggiIdHelper
 * @dev Pomocná knihovna pro práci s indexy a ID v kolekci BiggiEyes.
 */
library BiggiIdHelper {
    // --- Rozsahy tokenů, všechny začínají od 1 ---
    uint256 internal constant TICKET_OFFSET = 1;
    uint256 internal constant BIGGI_OFFSET = 1001;
    uint256 internal constant CHARACTER_OFFSET = 2001;
    uint256 internal constant REWARDS_OFFSET = 3001;
    uint256 internal constant MAX_SUPPLY = 550;

    /// Zjisti, zda jde o ticket (1 až 1000 včetně)
    function isTicket(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= TICKET_OFFSET && tokenId < BIGGI_OFFSET;
    }
    /// Zjisti, zda jde o hlavní NFT (1001 až 2000 včetně)
    function isMainNft(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= BIGGI_OFFSET && tokenId < CHARACTER_OFFSET;
    }
    /// Zjisti, zda jde o character NFT (2001 až 3000 včetně)
    function isCharacterNft(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= CHARACTER_OFFSET && tokenId < REWARDS_OFFSET;
    }
    /// Zjisti, zda jde o reward NFT (3001 až 3020 včetně – nastav dle počtu odměn)
    function isRewardNft(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= REWARDS_OFFSET && tokenId < REWARDS_OFFSET + 20;
    }

    /// Převod tokenId na index v mappingu nftInfo (začíná od 1)
    function nftIndexFromTokenId(uint256 tokenId) internal pure returns (uint256) {
        require(isMainNft(tokenId), "Not a main NFT");
        return tokenId - BIGGI_OFFSET + 1;
    }

    /// Převod indexu v nftInfo na tokenId (začíná od 1)
    function tokenIdFromNftIndex(uint256 idx) internal pure returns (uint256) {
        require(idx >= 1 && idx <= MAX_SUPPLY, "Index out of range");
        return BIGGI_OFFSET + idx - 1;
    }

    /// Vrací, zda daný index je validní pro mint (1 až 550)
    function isValidMintIndex(uint256 idx) internal pure returns (bool) {
        return idx >= 1 && idx <= MAX_SUPPLY;
    }

    /// Pomocník pro VRF: převod random čísla na index (1–550, nikdy 0!)
    function randomToMintIndex(uint256 random, uint256 totalSupply) internal pure returns (uint256) {
        require(totalSupply > 0 && totalSupply <= MAX_SUPPLY, "Bad supply");
        // Výstup index 1–550
        return (random % MAX_SUPPLY) + 1;
    }

    /// Typ tokenu (pro rozšíření)
    enum BiggiTokenType { Ticket, Main, Character, Reward, Unknown }
    function getTokenType(uint256 tokenId) internal pure returns (BiggiTokenType) {
        if (isTicket(tokenId)) return BiggiTokenType.Ticket;
        if (isMainNft(tokenId)) return BiggiTokenType.Main;
        if (isCharacterNft(tokenId)) return BiggiTokenType.Character;
        if (isRewardNft(tokenId)) return BiggiTokenType.Reward;
        return BiggiTokenType.Unknown;
    }

    // Další helpers můžeš doplnit zde...
}
