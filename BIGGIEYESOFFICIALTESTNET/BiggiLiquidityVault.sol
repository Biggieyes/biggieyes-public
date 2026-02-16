// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
LiquidityVault — plně konzistentní verze pro větev:
Reserve (BiggiReserveV4)  ->  LiquidityManager  ->  LiquidityVault

Cíl:
- Router mintne LP přímo do vaultu (param "to" v addLiquidityETH)
- LM po úspěchu zavolá syncPairBalance(pair), aby se interní účetnictví dorovnalo
- LM může také posílat LP přes depositLP (pokud se někdy použije jiný flow)
- Owner (multisig) whitelistuje LP páry a může uvolnit LP tokeny (governance)

DŮLEŽITÉ:
- Žádná admin logika pro uživatele; vault je custody.
- Všechny funkce, které hýbou LP, jsou:
  - onlyLM (depositLP, withdrawToLM, syncPairBalance)
  - onlyOwner (whitelist, releaseLP, rescue)
*/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract LiquidityVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address payable;

    // Liquidity Manager address (nastavuje owner)
    address public liquidityManager;

    // Whitelistované LP páry (LP token contract addresses)
    mapping(address => bool) public whitelistedPairs;

    // Interní účetnictví LP tokenů (lpToken => amount)
    mapping(address => uint256) private _lpBalances;

    /* ============ Events ============ */
    event LiquidityManagerSet(address indexed oldLM, address indexed newLM);
    event PairWhitelisted(address indexed lpPair);
    event PairRemovedFromWhitelist(address indexed lpPair);

    event Deposited(address indexed lpPair, address indexed from, uint256 amount, uint256 newBalance);
    event Released(address indexed lpPair, address indexed to, uint256 amount, uint256 newBalance);
    event WithdrawnToLM(address indexed lpPair, uint256 amount, uint256 newBalance);
    event Synced(address indexed lpPair, uint256 newBalance);

    event RescueERC20(address indexed token, address indexed to, uint256 amount);
    event RescueNative(address indexed to, uint256 amount);

    modifier onlyLM() {
        require(msg.sender == liquidityManager, "LiquidityVault: only LM");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    /* ============ Owner actions ============ */

    /// @notice Nastaví adresu Liquidity Managera
    function setLiquidityManager(address lm) external onlyOwner {
        require(lm != address(0), "zero addr");
        emit LiquidityManagerSet(liquidityManager, lm);
        liquidityManager = lm;
    }

    /// @notice Přidat LP pair do whitelistu (owner only)
    function addWhitelistedPair(address lpPair) external onlyOwner {
        require(lpPair != address(0), "zero addr");
        require(!whitelistedPairs[lpPair], "already whitelisted");
        whitelistedPairs[lpPair] = true;
        emit PairWhitelisted(lpPair);
    }

    /// @notice Odebrat LP pair z whitelistu (owner only)
    function removeWhitelistedPair(address lpPair) external onlyOwner {
        require(whitelistedPairs[lpPair], "not whitelisted");
        whitelistedPairs[lpPair] = false;
        emit PairRemovedFromWhitelist(lpPair);
    }

    /// @notice Owner uvolní (částečně nebo úplně) LP tokeny na cílovou adresu
    /// @param lpPair LP token contract address (musí být whitelisted)
    /// @param amount kolik LP tokenů poslat
    /// @param to cílová adresa
    function releaseLP(address lpPair, uint256 amount, address to) external onlyOwner nonReentrant {
        require(whitelistedPairs[lpPair], "pair not whitelisted");
        require(to != address(0), "to zero");
        require(amount > 0, "zero amount");

        uint256 bal = _lpBalances[lpPair];
        require(bal >= amount, "insufficient vault balance");

        _lpBalances[lpPair] = bal - amount;
        IERC20(lpPair).safeTransfer(to, amount);

        emit Released(lpPair, to, amount, _lpBalances[lpPair]);
    }

    /* ============ LM actions ============ */

    /// @notice LM vkládá LP tokeny do vaultu (only LM)
    /// @dev Použij jen pokud LP tokeny nejsou mintnuté přímo do vaultu (fallback flow).
    function depositLP(address lpPair, uint256 amount) external nonReentrant onlyLM {
        require(whitelistedPairs[lpPair], "pair not whitelisted");
        require(amount > 0, "zero amount");

        IERC20(lpPair).safeTransferFrom(msg.sender, address(this), amount);

        _lpBalances[lpPair] += amount;
        emit Deposited(lpPair, msg.sender, amount, _lpBalances[lpPair]);
    }

    /// @notice LM si vybere část LP tokenů zpět na svou adresu (only LM)
    /// @dev Typicky pro removeLiquidity / další operace.
    function withdrawToLM(address lpPair, uint256 amount) external nonReentrant onlyLM {
        require(whitelistedPairs[lpPair], "pair not whitelisted");
        require(amount > 0, "zero amount");

        uint256 bal = _lpBalances[lpPair];
        require(bal >= amount, "insufficient vault balance");

        _lpBalances[lpPair] = bal - amount;
        IERC20(lpPair).safeTransfer(liquidityManager, amount);

        emit WithdrawnToLM(lpPair, amount, _lpBalances[lpPair]);
    }

    /// @notice Synchronizuje interní evidenci s aktuálním zůstatkem LP ve vaultu
    /// @dev Router mintne LP přímo do vaultu, takže LM zavolá syncPairBalance
    function syncPairBalance(address lpPair) external onlyLM {
        require(whitelistedPairs[lpPair], "pair not whitelisted");

        uint256 realBal = IERC20(lpPair).balanceOf(address(this));
        _lpBalances[lpPair] = realBal;

        emit Synced(lpPair, realBal);
    }

    /* ============ Views ============ */

    /// @notice Kolik LP tokenů vault eviduje pro daný lpPair (interní účetnictví)
    function lpBalanceOf(address lpPair) external view returns (uint256) {
        return _lpBalances[lpPair];
    }

    /// @notice "Real" LP balance přímo z ERC20 balanceOf (audit helper)
    function lpBalanceReal(address lpPair) external view returns (uint256) {
        return IERC20(lpPair).balanceOf(address(this));
    }

    /// @notice Jednoduchý snapshot pro FE: whitelist + účetní + real balance
    function lpSnapshot(address lpPair) external view returns (bool whitelisted, uint256 accounted, uint256 realBal) {
        whitelisted = whitelistedPairs[lpPair];
        accounted = _lpBalances[lpPair];
        realBal = IERC20(lpPair).balanceOf(address(this));
    }

    /* ============ Rescue / Admin ============ */

    /// @notice Nouzové vybrání ERC20 tokenu (only owner)
    /// @dev Nedoporučeno pro LP (na to je releaseLP). Používej pouze pro "cizí" tokeny omylem poslané do vaultu.
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "to0");
        IERC20(token).safeTransfer(to, amount);
        emit RescueERC20(token, to, amount);
    }

    /// @notice Nouzové vybrání native (POL/ETH) (only owner)
    function rescueNative(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "to0");
        to.sendValue(amount);
        emit RescueNative(to, amount);
    }
}
