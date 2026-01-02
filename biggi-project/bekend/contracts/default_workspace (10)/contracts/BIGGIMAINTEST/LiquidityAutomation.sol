// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILiquidityManager {
    function executePairing(uint256 requestedMatic) external;
    function router() external view returns (address);
    function reserve() external view returns (address);
    function tokenPct() external view returns (uint8);
}

interface IReserveV4View {
    function getMaticAvailable() external view returns (uint256);
    function availableForDexRefill() external view returns (uint256);
}

interface IRouterLike {
    function WETH() external view returns (address);
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
}

/// @title LiquidityAutomation
/// @notice Chainlink Automation-compatible keeper that triggers BiggiLiquidityManager.executePairing with adaptive amounts.
contract LiquidityAutomation is Ownable, ReentrancyGuard {
    ILiquidityManager public lm;
    IERC20 public immutable biggi;

    uint256 public minMaticWei;     // lower bound per run
    uint256 public maxMaticWei;     // upper bound per run
    uint256 public minIntervalSec;  // min seconds between runs
    uint256 public lastUpkeepTime;  // timestamp of last successful perform

    event LimitsSet(uint256 minMaticWei, uint256 maxMaticWei);
    event IntervalSet(uint256 minIntervalSec);
    event LMSet(address lm);
    event UpkeepPerformed(uint256 requestedMatic, address caller);

    constructor(
        address lm_,
        address biggi_,
        uint256 minMaticWei_,
        uint256 maxMaticWei_,
        uint256 minIntervalSec_,
        address initialOwner
    ) Ownable(initialOwner) {
        require(lm_ != address(0), "lm0");
        require(biggi_ != address(0), "biggi0");
        require(minMaticWei_ > 0, "min0");
        require(maxMaticWei_ >= minMaticWei_, "max<min");
        require(minIntervalSec_ > 0, "interval0");

        lm = ILiquidityManager(lm_);
        biggi = IERC20(biggi_);
        minMaticWei = minMaticWei_;
        maxMaticWei = maxMaticWei_;
        minIntervalSec = minIntervalSec_;
    }

    /* ---------------------------- owner setters ---------------------------- */
    function setLimits(uint256 minWei, uint256 maxWei) external onlyOwner {
        require(minWei > 0, "min0");
        require(maxWei >= minWei, "max<min");
        minMaticWei = minWei;
        maxMaticWei = maxWei;
        emit LimitsSet(minWei, maxWei);
    }

    function setMinInterval(uint256 sec_) external onlyOwner {
        require(sec_ > 0, "interval0");
        minIntervalSec = sec_;
        emit IntervalSet(sec_);
    }

    function setLM(address lm_) external onlyOwner {
        require(lm_ != address(0), "lm0");
        lm = ILiquidityManager(lm_);
        emit LMSet(lm_);
    }

    /* --------------------------- Chainlink hooks --------------------------- */
    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData) {
        // interval gate
        if (block.timestamp < lastUpkeepTime + minIntervalSec) {
            return (false, bytes(""));
        }

        (bool ok, uint256 amount) = _computeRequested();
        if (!ok) {
            return (false, bytes(""));
        }

        return (true, abi.encode(amount));
    }

    function performUpkeep(bytes calldata performData) external nonReentrant {
        uint256 requested = performData.length > 0 ? abi.decode(performData, (uint256)) : 0;

        // recompute if not provided
        if (requested == 0) {
            (bool ok, uint256 amount) = _computeRequested();
            require(ok, "no-upkeep");
            requested = amount;
        }

        require(block.timestamp >= lastUpkeepTime + minIntervalSec, "too-soon");
        lastUpkeepTime = block.timestamp;

        lm.executePairing(requested);
        emit UpkeepPerformed(requested, msg.sender);
    }

    /* ------------------------------- internal ------------------------------ */
    function _computeRequested() internal view returns (bool ok, uint256 amount) {
        address reserveAddr = lm.reserve();
        address routerAddr = lm.router();
        if (reserveAddr == address(0) || routerAddr == address(0)) {
            return (false, 0);
        }

        // native available on reserve (prefer getMaticAvailable, fallback to balance)
        uint256 availableNative = _safeGetMatic(reserveAddr);
        if (availableNative < minMaticWei) {
            return (false, 0);
        }

        uint256 requested = availableNative;
        if (requested > maxMaticWei) requested = maxMaticWei;
        if (requested < minMaticWei) {
            return (false, 0);
        }

        // quote MATIC -> BIGGI
        address[] memory path = new address[](2);
        path[0] = IRouterLike(routerAddr).WETH();
        path[1] = address(biggi);

        uint256[] memory amounts;
        try IRouterLike(routerAddr).getAmountsOut(requested, path) returns (uint256[] memory out) {
            amounts = out;
        } catch {
            return (false, 0);
        }

        if (amounts.length < 2 || amounts[amounts.length - 1] == 0) {
            return (false, 0);
        }

        uint8 pct = lm.tokenPct();
        if (pct == 0) {
            return (false, 0);
        }

        uint256 neededBiggi = (amounts[amounts.length - 1] * uint256(pct)) / 100;
        if (neededBiggi == 0) {
            return (false, 0);
        }

        // check reserve BIGGI
        uint256 availableBiggi = _safeBiggi(reserveAddr);
        if (availableBiggi < neededBiggi) {
            return (false, 0);
        }

        return (true, requested);
    }

    function _safeGetMatic(address reserveAddr) internal view returns (uint256) {
        uint256 available = address(reserveAddr).balance;
        try IReserveV4View(reserveAddr).getMaticAvailable() returns (uint256 m) {
            if (m > 0) available = m;
        } catch {}
        return available;
    }

    function _safeBiggi(address reserveAddr) internal view returns (uint256) {
        uint256 available = biggi.balanceOf(reserveAddr);
        try IReserveV4View(reserveAddr).availableForDexRefill() returns (uint256 b) {
            if (b > 0) available = b;
        } catch {}
        return available;
    }

    // accept dust/native refunds if any
    receive() external payable {}
}
