// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  BiggiToken.sol — OZ v5 kompatibilní, plně konzistentní verze

  Co je důležité:
  - initialDistribute() mintne jednorázově do: Reserve, DripDistributor, TokenRewards
  - PO MINTU do DripDistributor auto zavolá DripDistributor.notifyTokenMint(dripAmt)
    (to je ta změna flow, kterou jsi chtěl)
  - pause() reálně blokuje transfery (správný OZ5 hook přes _update)
  - transferFromReserveTo() zachováno beze změn (owner může přesunout z reserveAddr kamkoliv)

  Pozn.: DripDistributor.notifyTokenMint je navrženo tak, že smí být voláno jen samotným tokenem
  (msg.sender == address(BIGGI)), což tady přesně splňujeme.
*/

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./BiggiCapsLib.sol";

interface IBiggiDripDistributorNotify {
    function notifyTokenMint(uint256 amount) external;
}

contract BiggiToken is ERC20, ERC20Burnable, ERC20Permit, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // ---- Constants / config ----
    uint256 public constant CAP = BiggiCapsLib.BIGGI_TOTAL_SUPPLY;

    // Addresses (set by owner before initial distribution)
    address public reserveAddr;
    address public dripDistributorAddr;
    address public tokenRewardsAddr;
    address public rewardsOperator;

    bool public distributed;

    // Events
    event InitialDistribution(
        address indexed reserve,
        address indexed dripDistributor,
        address indexed tokenRewards,
        uint256 reserveAmt,
        uint256 dripAmt,
        uint256 rewardsAmt
    );
    event ReserveSet(address indexed oldAddr, address indexed newAddr);
    event DripDistributorSet(address indexed oldAddr, address indexed newAddr);
    event TokenRewardsSet(address indexed oldAddr, address indexed newAddr);
    event RewardsOperatorSet(address indexed oldOp, address indexed newOp);

    event RewardsRefilled(uint256 beforeBal, uint256 afterBal, uint256 minted);
    event RescueERC20(address token, address to, uint256 amount);
    event ReserveTransfer(address indexed to, uint256 amount, address indexed caller);

    // Constructor: owner must be provided (Ownable(initialOwner))
    constructor(address initialOwner)
        ERC20("Biggi Token", "BIGGI")
        ERC20Permit("Biggi Token")
        Ownable(initialOwner)
    {
        // admin will call setters and initialDistribute()
    }

    // -------------------- Setters (owner) --------------------
    function setReserve(address _reserve) external onlyOwner {
        require(_reserve != address(0), "reserve=0");
        emit ReserveSet(reserveAddr, _reserve);
        reserveAddr = _reserve;
    }

    function setDripDistributor(address _drip) external onlyOwner {
        require(_drip != address(0), "drip=0");
        emit DripDistributorSet(dripDistributorAddr, _drip);
        dripDistributorAddr = _drip;
    }

    function setTokenRewards(address _rewards) external onlyOwner {
        require(_rewards != address(0), "rewards=0");
        emit TokenRewardsSet(tokenRewardsAddr, _rewards);
        tokenRewardsAddr = _rewards;
    }

    function setRewardsOperator(address _op) external onlyOwner {
        emit RewardsOperatorSet(rewardsOperator, _op);
        rewardsOperator = _op;
    }

    // -------------------- Initial distribution (one-time) --------------------
    function initialDistribute() external onlyOwner {
        require(!distributed, "already distributed");
        require(
            reserveAddr != address(0) &&
            dripDistributorAddr != address(0) &&
            tokenRewardsAddr != address(0),
            "addrs not set"
        );

        uint256 reserveAmt = BiggiCapsLib.RESERVE_INITIAL;          // např. 300M
        uint256 dripAmt    = BiggiCapsLib.DRIP_DISTRIBUTOR_CAP;     // např. 100M
        uint256 rewardsAmt = BiggiCapsLib.TOKEN_REWARDS_CAP;        // např. 100M

        require(totalSupply() + reserveAmt + dripAmt + rewardsAmt <= CAP, "cap exceeded");

        // 1) Mint do Reserve
        _mint(reserveAddr, reserveAmt);

        // 2) Mint do DripDistributor
        _mint(dripDistributorAddr, dripAmt);

        // 3) AUTO NOTIFIKACE: DripDistributor se dozví o mintu (accounting + CAP kontrola je uvnitř)
        //    - DripDistributor si uvnitř ověřuje, že tokeny už na něm fyzicky jsou.
        IBiggiDripDistributorNotify(dripDistributorAddr).notifyTokenMint(dripAmt);

        // 4) Mint do TokenRewards
        _mint(tokenRewardsAddr, rewardsAmt);

        distributed = true;

        emit InitialDistribution(
            reserveAddr,
            dripDistributorAddr,
            tokenRewardsAddr,
            reserveAmt,
            dripAmt,
            rewardsAmt
        );
    }

    // -------------------- Přesuň tokeny z reserveAddr (ONLY OWNER) --------------------
    function transferFromReserveTo(address to, uint256 amount) external onlyOwner {
        require(reserveAddr != address(0), "reserve not set");
        require(to != address(0), "to0");
        require(amount > 0, "zero amount");

        uint256 bal = balanceOf(reserveAddr);
        require(bal >= amount, "insufficient reserve balance");

        _transfer(reserveAddr, to, amount);

        emit ReserveTransfer(to, amount, msg.sender);
    }

    // -------------------- refillRewardsIfBelow --------------------
    function refillRewardsIfBelow(uint256 minBalance, uint256 targetBalance) external {
        require(msg.sender == rewardsOperator, "only rewardsOperator");
        require(tokenRewardsAddr != address(0), "tokenRewards not set");
        require(targetBalance > minBalance, "bad targets");

        uint256 balBefore = balanceOf(tokenRewardsAddr);
        if (balBefore >= minBalance) {
            emit RewardsRefilled(balBefore, balBefore, 0);
            return;
        }

        uint256 toMint = targetBalance - balBefore;
        require(totalSupply() + toMint <= CAP, "cap exceeded");

        _mint(tokenRewardsAddr, toMint);

        uint256 balAfter = balanceOf(tokenRewardsAddr);
        emit RewardsRefilled(balBefore, balAfter, toMint);
    }

    // -------------------- Emergency mint --------------------
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= CAP, "cap exceeded");
        _mint(to, amount);
    }

    // -------------------- Pausable --------------------
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // OZ v5: správný hook pro “pause blokuje transfery”
    function _update(address from, address to, uint256 value) internal override {
        require(!paused(), "token transfer while paused");
        super._update(from, to, value);
    }

    // -------------------- Views / helpers --------------------
    function remainingMintable() external view returns (uint256) {
        return CAP - totalSupply();
    }

    function tokenMeta() external view returns (string memory name_, string memory symbol_, uint8 decimals_) {
        name_ = name();
        symbol_ = symbol();
        decimals_ = 18;
    }

    // -------------------- Rescue --------------------
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "to0");
        IERC20(token).safeTransfer(to, amount);
        emit RescueERC20(token, to, amount);
    }
}
