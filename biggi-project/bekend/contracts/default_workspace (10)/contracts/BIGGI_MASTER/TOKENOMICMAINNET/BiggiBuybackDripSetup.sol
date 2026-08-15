// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IBiggiBuybackAgent {
    function setRouter(address router_) external;
    function setTreasury(address treasury_) external;
    function setPolicy(address policy_) external;
    function setDripLM(address dripLM_) external;
    function setSwapPath(address[] calldata newPath) external;
    function clearSwapPath() external;
    function setFallbacks(uint256 slipBps, uint256 deadlineSec, uint256 cooldownSec) external;
    function toggleAutoBuyback(bool enabled) external;
}

interface IBiggiDripLiquidityManager {
    function setRouter(address r) external;
    function setReserve(address r) external;
    function setDripDistributor(address d) external;
    function setBuybackAgent(address a) external;
    function setSellPct(uint8 pct) external;
    function setSlippageBps(uint256 bps) external;
    function setTxDeadlineSec(uint256 sec_) external;
}

interface IDripDistributorSetup {
    function setDripLM(address lm) external;
    function setTreasury(address t) external;
    function setTokensPerMintOperator(address op) external;
    function setTokensPerMint(uint256 v) external;
    function setCollection(address coll, bool allowed) external;
}

interface IBiggiTokenSupplySetup {
    function setSupplyController(address c) external;
}

interface IBiggiSupplyControllerSetup {
    function setPair(address pair_) external;
    function snapshotBaseline() external;
}

interface IBiggiPolicySetup {
    function setBuybackAgent(address agent) external;
}

contract BiggiBuybackDripSetup is Ownable {
    address public immutable buybackAgent;
    address public immutable dripLM;
    address public immutable dripDistributor;
    address public immutable reserveAddr;
    address public immutable treasuryAddr;
    address public immutable routerAddr;
    address public immutable policyAddr;

    address public tokenAddr;
    address public supplyController;
    bool public executed;

    event BranchSetupExecuted(address indexed buybackAgent, address indexed dripLM, address indexed dripDistributor);
    event SupplyTargetsSet(address indexed token, address indexed supplyController);
    event SupplyControllerWired(address indexed token, address indexed supplyController);
    event SupplyControllerPairConfigured(address indexed pair, bool baselineSnapshotted);

    constructor(address initialOwner,address buybackAgent_,address dripLM_,address dripDistributor_,address reserveAddr_,address treasuryAddr_,address routerAddr_,address policyAddr_) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner=0");
        require(buybackAgent_ != address(0), "buyback=0");
        require(dripLM_ != address(0), "dripLM=0");
        require(dripDistributor_ != address(0), "dripD=0");
        require(reserveAddr_ != address(0), "reserve=0");
        require(treasuryAddr_ != address(0), "treasury=0");
        require(routerAddr_ != address(0), "router=0");
        buybackAgent = buybackAgent_; dripLM = dripLM_; dripDistributor = dripDistributor_; reserveAddr = reserveAddr_; treasuryAddr = treasuryAddr_; routerAddr = routerAddr_; policyAddr = policyAddr_;
    }

    function setupBuybackCore() public onlyOwner {
        IBiggiBuybackAgent B = IBiggiBuybackAgent(buybackAgent);
        B.setRouter(routerAddr);
        B.setTreasury(treasuryAddr);
        B.setPolicy(policyAddr);
        if (policyAddr != address(0)) {
            // Best effort: if setup contract is not policy owner in a given environment,
            // keep setup flow alive and let owner wire policy caller explicitly.
            try IBiggiPolicySetup(policyAddr).setBuybackAgent(buybackAgent) {
            } catch {}
        }
        B.setDripLM(dripLM);
    }

    function configureBuybackSwapAndFallbacks(address[] calldata path,uint256 slipBps,uint256 deadline,uint256 cooldown,bool autoEnable) public onlyOwner {
        IBiggiBuybackAgent B = IBiggiBuybackAgent(buybackAgent);
        if (path.length == 0) B.clearSwapPath(); else B.setSwapPath(path);
        B.setFallbacks(slipBps, deadline, cooldown);
        B.toggleAutoBuyback(autoEnable);
    }

    function setupDripLMCore() public onlyOwner {
        IBiggiDripLiquidityManager D = IBiggiDripLiquidityManager(dripLM);
        D.setRouter(routerAddr); D.setReserve(reserveAddr); D.setDripDistributor(dripDistributor); D.setBuybackAgent(buybackAgent);
    }

    function configureDripLMParams(uint8 sellPct,uint256 slipBps,uint256 deadline) public onlyOwner {
        IBiggiDripLiquidityManager D = IBiggiDripLiquidityManager(dripLM);
        D.setSellPct(sellPct); D.setSlippageBps(slipBps); D.setTxDeadlineSec(deadline);
    }

    function setupDripDistributorCore(address treasury,uint256 tokensPerMint) public onlyOwner {
        require(treasury != address(0), "treasury=0");
        IDripDistributorSetup DD = IDripDistributorSetup(dripDistributor);
        DD.setTreasury(treasury);
        DD.setDripLM(dripLM);
        DD.setTokensPerMintOperator(dripLM);
        DD.setTokensPerMint(tokensPerMint);
    }

    function setSupplyTargets(address token_, address supplyController_) external onlyOwner {
        require(token_ != address(0), "token=0"); require(supplyController_ != address(0), "supply=0");
        tokenAddr = token_; supplyController = supplyController_; emit SupplyTargetsSet(token_, supplyController_);
    }

    function setupSupplyControllerCore() public onlyOwner {
        require(tokenAddr != address(0) && supplyController != address(0), "supply targets missing");
        IBiggiTokenSupplySetup(tokenAddr).setSupplyController(supplyController);
        emit SupplyControllerWired(tokenAddr, supplyController);
    }

    function configureSupplyControllerPair(address pair, bool snapshotBaseline_) public onlyOwner {
        require(supplyController != address(0), "supply=0"); require(pair != address(0), "pair=0");
        IBiggiSupplyControllerSetup(supplyController).setPair(pair);
        if (snapshotBaseline_) IBiggiSupplyControllerSetup(supplyController).snapshotBaseline();
        emit SupplyControllerPairConfigured(pair, snapshotBaseline_);
    }

    function runAll(address[] calldata buybackPath,uint256 buybackSlipBps,uint256 buybackDeadline,uint256 buybackCooldown,bool autoEnable,uint8 dripSellPct,uint256 dripSlippage,uint256 dripDeadline,address treasuryForDrip,uint256 tokensPerMint) external onlyOwner {
        require(!executed, "already executed");
        setupBuybackCore();
        configureBuybackSwapAndFallbacks(buybackPath, buybackSlipBps, buybackDeadline, buybackCooldown, autoEnable);
        setupDripLMCore();
        configureDripLMParams(dripSellPct, dripSlippage, dripDeadline);
        setupDripDistributorCore(treasuryForDrip, tokensPerMint);
        executed = true;
        emit BranchSetupExecuted(buybackAgent, dripLM, dripDistributor);
    }

    function runAllAndWireSupply(address[] calldata buybackPath,uint256 buybackSlipBps,uint256 buybackDeadline,uint256 buybackCooldown,bool autoEnable,uint8 dripSellPct,uint256 dripSlippage,uint256 dripDeadline,address treasuryForDrip,uint256 tokensPerMint,address tokenForSupply,address supplyController_,address pairForSupply,bool snapshotSupplyBaseline) external onlyOwner {
        require(!executed, "already executed");
        tokenAddr = tokenForSupply; supplyController = supplyController_; emit SupplyTargetsSet(tokenForSupply, supplyController_);
        setupBuybackCore();
        configureBuybackSwapAndFallbacks(buybackPath, buybackSlipBps, buybackDeadline, buybackCooldown, autoEnable);
        setupDripLMCore();
        configureDripLMParams(dripSellPct, dripSlippage, dripDeadline);
        setupDripDistributorCore(treasuryForDrip, tokensPerMint);
        setupSupplyControllerCore();
        if (pairForSupply != address(0)) configureSupplyControllerPair(pairForSupply, snapshotSupplyBaseline);
        executed = true;
        emit BranchSetupExecuted(buybackAgent, dripLM, dripDistributor);
    }
}
