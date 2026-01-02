// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  KeeperProxy — Chainlink Automation integration (opraveno)
  - drobná oprava: používá Address.sendValue(...) místo to.sendValue(...)
  - žádná další logika změněna
*/

import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

interface IReserveView {
    function getMaticAvailable() external view returns (uint256);
    function availableForDexRefill() external view returns (uint256);
}

interface ILiquidityManager {
    function executePairing(uint256 requestedMatic) external;
}

contract KeeperProxy is AutomationCompatibleInterface, Ownable {
    using Address for address;

    address public reserve;
    address public lm; // LiquidityManager
    uint256 public interval; // seconds
    uint256 public lastTime;
    uint256 public minMatic;   // threshold in native (wei)
    uint256 public minTokens;  // threshold in BIGGI (wei)
    uint256 public requestedMatic; // how much MATIC to request each upkeep

    event ConfigUpdated(address reserve, address lm, uint256 interval, uint256 minMatic, uint256 minTokens, uint256 requestedMatic);
    event Performed(uint256 timestamp, uint256 requestedMatic);

    constructor(
        address reserve_,
        address lm_,
        uint256 intervalSec,
        uint256 minMatic_,
        uint256 minTokens_,
        uint256 requestedMatic_
    ) Ownable(msg.sender) {
        reserve = reserve_;
        lm = lm_;
        interval = intervalSec;
        minMatic = minMatic_;
        minTokens = minTokens_;
        requestedMatic = requestedMatic_;
        lastTime = block.timestamp;
        emit ConfigUpdated(reserve, lm, interval, minMatic, minTokens, requestedMatic);
    }

    function setConfig(
        address reserve_,
        address lm_,
        uint256 intervalSec,
        uint256 minMatic_,
        uint256 minTokens_,
        uint256 requestedMatic_
    ) external onlyOwner {
        reserve = reserve_;
        lm = lm_;
        interval = intervalSec;
        minMatic = minMatic_;
        minTokens = minTokens_;
        requestedMatic = requestedMatic_;
        emit ConfigUpdated(reserve, lm, interval, minMatic, minTokens, requestedMatic);
    }

    // Chainlink Automation: view checkUpkeep
    function checkUpkeep(bytes calldata /* checkData */) external view override returns (bool upkeepNeeded, bytes memory performData) {
        if (reserve == address(0) || lm == address(0)) return (false, bytes(""));
        // time condition
        if (block.timestamp < lastTime + interval) return (false, bytes(""));

        // reserve thresholds
        uint256 availableMatic = IReserveView(reserve).getMaticAvailable();
        uint256 availableTokens = IReserveView(reserve).availableForDexRefill();

        if (availableMatic >= minMatic && availableTokens >= minTokens) {
            upkeepNeeded = true;
            performData = abi.encode(requestedMatic);
        } else {
            upkeepNeeded = false;
            performData = bytes("");
        }
    }

    // Chainlink Automation: performUpkeep
    function performUpkeep(bytes calldata performData) external override {
        // decode requestedMatic (if provided)
        uint256 req = requestedMatic;
        if (performData.length >= 32) {
            req = abi.decode(performData, (uint256));
        }

        // sanity
        require(reserve != address(0) && lm != address(0), "config missing");

        // call LM
        ILiquidityManager(lm).executePairing(req);

        // update lastTime after successful call (no try/catch here; Chainlink will revert on failure)
        lastTime = block.timestamp;
        emit Performed(block.timestamp, req);
    }

    // owner helpers
    function setRequestedMatic(uint256 v) external onlyOwner { requestedMatic = v; }
    function setInterval(uint256 v) external onlyOwner { interval = v; }
    function setThresholds(uint256 minMatic_, uint256 minTokens_) external onlyOwner { minMatic = minMatic_; minTokens = minTokens_; }

    // allow owner to rescue native (if something accidentally sent here)
    function rescueNative(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "to0");
        // opravené volání přes Address library
        Address.sendValue(to, amount);
    }

    // allow owner to call arbitrary safe management calls if needed (avoid misuse)
    function exec(address target, bytes calldata data) external onlyOwner returns (bytes memory) {
        require(target != address(0), "t0");
        (bool ok, bytes memory ret) = target.call(data);
        require(ok, "exec fail");
        return ret;
    }

    receive() external payable {}
    fallback() external payable {}
}
