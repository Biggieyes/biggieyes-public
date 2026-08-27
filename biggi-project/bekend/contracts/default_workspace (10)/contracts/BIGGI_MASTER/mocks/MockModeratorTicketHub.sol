// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockModeratorTicketHub {
    struct Chapter {
        bool exists;
        uint16 totalCap;
        uint16 marketingCap;
        uint16 marketingMinted;
        uint16 saleCap;
        uint16 saleMinted;
        uint256 totalMinted;
    }

    mapping(uint256 => Chapter) private _chapters;
    mapping(uint256 => address) private _owners;
    mapping(uint256 => bool) public isTicket;
    mapping(uint256 => uint256) public ticketChapterId;

    function configureChapter(
        uint256 chapterId,
        uint16 totalCap,
        uint16 marketingCap,
        uint16 marketingMinted,
        uint16 saleCap,
        uint16 saleMinted,
        uint256 totalMinted
    ) external {
        _chapters[chapterId] = Chapter({
            exists: true,
            totalCap: totalCap,
            marketingCap: marketingCap,
            marketingMinted: marketingMinted,
            saleCap: saleCap,
            saleMinted: saleMinted,
            totalMinted: totalMinted
        });
    }

    function mintTicket(uint256 tokenId, uint256 chapterId, address to) external {
        require(to != address(0), "to=0");
        require(_owners[tokenId] == address(0), "minted");
        _owners[tokenId] = to;
        isTicket[tokenId] = true;
        ticketChapterId[tokenId] = chapterId;
    }

    function transferTicket(uint256 tokenId, address to) external {
        require(msg.sender == _owners[tokenId], "not owner");
        require(to != address(0), "to=0");
        _owners[tokenId] = to;
    }

    function burnTicket(uint256 tokenId) external {
        require(msg.sender == _owners[tokenId], "not owner");
        delete _owners[tokenId];
        delete isTicket[tokenId];
        delete ticketChapterId[tokenId];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "not minted");
        return tokenOwner;
    }

    function chapterExists(uint256 chapterId) external view returns (bool) {
        return _chapters[chapterId].exists;
    }

    function chapterTotalCap(uint256 chapterId) external view returns (uint16) {
        return _chapters[chapterId].totalCap;
    }

    function chapterTotalMinted(uint256 chapterId) external view returns (uint256) {
        return _chapters[chapterId].totalMinted;
    }

    function chapterMarketingCap(uint256 chapterId) external view returns (uint16) {
        return _chapters[chapterId].marketingCap;
    }

    function chapterMarketingMinted(uint256 chapterId) external view returns (uint16) {
        return _chapters[chapterId].marketingMinted;
    }

    function chapterSaleCap(uint256 chapterId) external view returns (uint16) {
        return _chapters[chapterId].saleCap;
    }

    function chapterSaleMinted(uint256 chapterId) external view returns (uint16) {
        return _chapters[chapterId].saleMinted;
    }
}
