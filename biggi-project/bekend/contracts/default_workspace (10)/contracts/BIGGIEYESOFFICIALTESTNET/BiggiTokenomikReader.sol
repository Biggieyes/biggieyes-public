// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
}

interface IUniswapV2Router02 {
    function WETH() external view returns (address);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

interface IMultiCollectionDistributor {
    function totalReceived() external view returns (uint256);
    function pending(address recipient) external view returns (uint256);
    function collectionRewards() external view returns (address);
    function reserve() external view returns (address);
    function buybackAgent() external view returns (address);
    function treasury() external view returns (address);
    function communityCenter() external view returns (address);
}

interface IBuybackAgent {
    function nativeBalance() external view returns (uint256);
    function biggiBalance() external view returns (uint256);
    function totalNativeReceived() external view returns (uint256);
    function totalNativeSpent() external view returns (uint256);
    function totalBiggiAcquired() external view returns (uint256);
    function autoBuybackEnabled() external view returns (bool);
    function paused() external view returns (bool);
    function lastBuybackAt() external view returns (uint256);
    function router() external view returns (address);
    function wrappedNative() external view returns (address);
    function treasury() external view returns (address);
}

interface IReserveV4 {
    function waitingBiggi() external view returns (uint256);
    function dexRefillBiggi() external view returns (uint256);
    function polBalance() external view returns (uint256);
}

interface ILiquidityManager {
    function keeper() external view returns (address);
}

interface ILiquidityVault {
    function whitelistedPairs(address lp) external view returns (bool);
    function lpBalanceOf(address lp) external view returns (uint256);
}

interface IDripDistributor {
    function availableTokens() external view returns (uint256);
    function totalClaimed() external view returns (uint256);
    function totalNotified() external view returns (uint256);
    function tokensPerMint() external view returns (uint256);
    function dripLM() external view returns (address);
    function totalReceived() external view returns (uint256);
}

interface IBiggiDripLMView {
    function reserve() external view returns (address);
    function moderatorCenter() external view returns (address);
    function reserveShareBps() external view returns (uint16);
    function moderatorShareBps() external view returns (uint16);
    function sellPct() external view returns (uint8);
    function slippageBps() external view returns (uint256);
    function txDeadlineSec() external view returns (uint256);
    function router() external view returns (address);
    function buybackAgent() external view returns (address);
}

interface ITokenRewards {
    function rewardsCap() external view returns (uint256);
    function rewardsMinted() external view returns (uint256);
    function unitReward() external view returns (uint256);
    function blockWeight(uint256 idx) external view returns (uint8);
    function tokenAddress() external view returns (address);
}

contract BiggiTokenomikReader {
    struct CoreStatus {
        address token;
        address weth;
        address router;
        address pair;
        uint112 reserveNative;
        uint112 reserveBiggi;
        uint256 lpTotalSupply;
        uint256 biggiPerNative;   // getAmountsOut(1 native)
        uint256 nativePerBiggi;   // getAmountsOut(1 BIGGI)
    }

    struct DistributorStatus {
        address distributor;
        uint256 totalReceived;
        uint256 pendingBuyback;
        address collectionRewards;
        address reserve;
        address buybackAgent;
        address treasury;
        address communityCenter;
    }

    struct BuybackStatus {
        address buybackAgent;
        uint256 nativeBalance;
        uint256 biggiBalance;
        uint256 totalNativeReceived;
        uint256 totalNativeSpent;
        uint256 totalBiggiAcquired;
        bool autoBuybackEnabled;
        bool paused;
        uint256 lastBuybackAt;
        address router;
        address wrappedNative;
        address treasury;
    }

    struct ReserveStatus {
        address reserve;
        uint256 polBalance;
        uint256 waitingBiggi;
        uint256 dexRefillBiggi;
        address liquidityManager;
        address keeper;
        address liquidityVault;
        bool pairWhitelisted;
        uint256 lpBalanceInVault;
    }

    struct DripStatus {
        address dripDistributor;
        uint256 availableTokens;
        uint256 totalReceived;
        uint256 totalClaimed;
        uint256 totalNotified;
        uint256 tokensPerMint;
        address dripLM;
        address dripReserve;
        address dripModeratorCenter;
        uint16 reserveShareBps;
        uint16 moderatorShareBps;
        uint8 sellPct;
        uint256 slippageBps;
        uint256 txDeadlineSec;
        address dripRouter;
        address dripBuyback;
    }

    struct TokenRewardsStatus {
        address tokenRewards;
        uint256 rewardsCap;
        uint256 rewardsMinted;
        uint256 balance;
        uint256 unitReward;
        uint8[11] blockWeights;
        address token;
    }

    address public immutable TOKEN;
    address public immutable WETH;
    address public immutable ROUTER;
    address public immutable PAIR;
    address public immutable DISTRIBUTOR;
    address public immutable BUYBACK;
    address public immutable RESERVE;
    address public immutable LIQUIDITY_MANAGER;
    address public immutable LIQUIDITY_VAULT;
    address public immutable DRIP_DISTRIBUTOR;
    address public immutable TOKEN_REWARDS;

    constructor(
        address token_,
        address router_,
        address pair_,
        address distributor_,
        address buyback_,
        address reserve_,
        address lm_,
        address vault_,
        address dripDistributor_,
        address tokenRewards_
    ) {
        TOKEN = token_;
        ROUTER = router_;
        PAIR = pair_;
        DISTRIBUTOR = distributor_;
        BUYBACK = buyback_;
        RESERVE = reserve_;
        LIQUIDITY_MANAGER = lm_;
        LIQUIDITY_VAULT = vault_;
        DRIP_DISTRIBUTOR = dripDistributor_;
        TOKEN_REWARDS = tokenRewards_;
        WETH = IUniswapV2Router02(router_).WETH();
    }

    function getFullStatus() external view returns (
        CoreStatus memory core,
        DistributorStatus memory dist,
        BuybackStatus memory buy,
        ReserveStatus memory res,
        DripStatus memory drip,
        TokenRewardsStatus memory tr
    ) {
        core = _coreStatus();
        dist = _distributorStatus();
        buy = _buybackStatus();
        res = _reserveStatus();
        drip = _dripStatus();
        tr = _tokenRewardsStatus();
    }

    function _coreStatus() internal view returns (CoreStatus memory c) {
        c.token = TOKEN;
        c.router = ROUTER;
        c.pair = PAIR;
        c.weth = WETH;
        // reserves (scaled to 1e18 regardless of token decimals)
        try IUniswapV2Pair(PAIR).getReserves() returns (uint112 r0, uint112 r1, uint32) {
            address t0 = IUniswapV2Pair(PAIR).token0();
            address t1 = IUniswapV2Pair(PAIR).token1();
            uint8 d0 = _decimals(t0);
            uint8 d1 = _decimals(t1);
            if (t0 == WETH) {
                c.reserveNative = uint112(_scaleTo1e18(r0, d0));
                c.reserveBiggi = uint112(_scaleTo1e18(r1, d1));
            } else if (t1 == WETH) {
                c.reserveNative = uint112(_scaleTo1e18(r1, d1));
                c.reserveBiggi = uint112(_scaleTo1e18(r0, d0));
            } else {
                // fallback: keep order r0/r1 scaled
                c.reserveNative = uint112(_scaleTo1e18(r0, d0));
                c.reserveBiggi = uint112(_scaleTo1e18(r1, d1));
            }
        } catch {}

        try IUniswapV2Pair(PAIR).totalSupply() returns (uint256 ts) {
            uint8 pd = _pairDecimals();
            c.lpTotalSupply = _scaleTo1e18(ts, pd);
        } catch {}

        // prices (simple getAmountsOut on router)
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = TOKEN;
        try IUniswapV2Router02(ROUTER).getAmountsOut(1e18, path) returns (uint[] memory amounts) {
            if (amounts.length > 1) c.biggiPerNative = amounts[1];
        } catch {}

        address[] memory path2 = new address[](2);
        path2[0] = TOKEN;
        path2[1] = WETH;
        try IUniswapV2Router02(ROUTER).getAmountsOut(1e18, path2) returns (uint[] memory amounts2) {
            if (amounts2.length > 1) c.nativePerBiggi = amounts2[1];
        } catch {}
    }

    function _decimals(address token) internal view returns (uint8) {
        try IERC20Metadata(token).decimals() returns (uint8 d) { return d; } catch { return 18; }
    }

    function _pairDecimals() internal view returns (uint8) {
        try IUniswapV2Pair(PAIR).decimals() returns (uint8 d) { return d; } catch { return 18; }
    }

    function _scaleTo1e18(uint256 amount, uint8 fromDecimals) internal pure returns (uint256) {
        if (fromDecimals == 18) return amount;
        if (fromDecimals > 18) {
            uint256 factor = 10 ** (fromDecimals - 18);
            return amount / factor;
        }
        uint256 factorUp = 10 ** (18 - fromDecimals);
        return amount * factorUp;
    }

    function _distributorStatus() internal view returns (DistributorStatus memory d) {
        d.distributor = DISTRIBUTOR;
        IMultiCollectionDistributor mc = IMultiCollectionDistributor(DISTRIBUTOR);
        try mc.totalReceived() returns (uint256 trc) { d.totalReceived = trc; } catch {}
        try mc.pending(BUYBACK) returns (uint256 p) { d.pendingBuyback = p; } catch {}
        try mc.collectionRewards() returns (address a) { d.collectionRewards = a; } catch {}
        try mc.reserve() returns (address a2) { d.reserve = a2; } catch {}
        try mc.buybackAgent() returns (address a3) { d.buybackAgent = a3; } catch {}
        try mc.treasury() returns (address a4) { d.treasury = a4; } catch {}
        try mc.communityCenter() returns (address a5) { d.communityCenter = a5; } catch {}
    }

    function _buybackStatus() internal view returns (BuybackStatus memory b) {
        b.buybackAgent = BUYBACK;
        IBuybackAgent ba = IBuybackAgent(BUYBACK);
        try ba.nativeBalance() returns (uint256 v) { b.nativeBalance = v; } catch {}
        try ba.biggiBalance() returns (uint256 v2) { b.biggiBalance = v2; } catch {}
        try ba.totalNativeReceived() returns (uint256 v3) { b.totalNativeReceived = v3; } catch {}
        try ba.totalNativeSpent() returns (uint256 v4) { b.totalNativeSpent = v4; } catch {}
        try ba.totalBiggiAcquired() returns (uint256 v5) { b.totalBiggiAcquired = v5; } catch {}
        try ba.autoBuybackEnabled() returns (bool v6) { b.autoBuybackEnabled = v6; } catch {}
        try ba.paused() returns (bool v7) { b.paused = v7; } catch {}
        try ba.lastBuybackAt() returns (uint256 v8) { b.lastBuybackAt = v8; } catch {}
        try ba.router() returns (address r) { b.router = r; } catch {}
        try ba.wrappedNative() returns (address w) { b.wrappedNative = w; } catch {}
        try ba.treasury() returns (address t) { b.treasury = t; } catch {}
    }

    function _reserveStatus() internal view returns (ReserveStatus memory r) {
        r.reserve = RESERVE;
        r.liquidityManager = LIQUIDITY_MANAGER;
        r.liquidityVault = LIQUIDITY_VAULT;

        IReserveV4 res = IReserveV4(RESERVE);
        try res.polBalance() returns (uint256 vp) { r.polBalance = vp; } catch {}
        try res.waitingBiggi() returns (uint256 v2) { r.waitingBiggi = v2; } catch {}
        try res.dexRefillBiggi() returns (uint256 v3) { r.dexRefillBiggi = v3; } catch {}

        try ILiquidityManager(LIQUIDITY_MANAGER).keeper() returns (address k) { r.keeper = k; } catch {}
        try ILiquidityVault(LIQUIDITY_VAULT).whitelistedPairs(PAIR) returns (bool w) { r.pairWhitelisted = w; } catch {}
        try ILiquidityVault(LIQUIDITY_VAULT).lpBalanceOf(PAIR) returns (uint256 lp) { r.lpBalanceInVault = lp; } catch {}
    }

    function _dripStatus() internal view returns (DripStatus memory d) {
        d.dripDistributor = DRIP_DISTRIBUTOR;
        IDripDistributor dd = IDripDistributor(DRIP_DISTRIBUTOR);
        try dd.availableTokens() returns (uint256 v) { d.availableTokens = v; } catch {}
        try dd.totalReceived() returns (uint256 v2) { d.totalReceived = v2; } catch {}
        try dd.totalClaimed() returns (uint256 v3) { d.totalClaimed = v3; } catch {}
        try dd.totalNotified() returns (uint256 v4) { d.totalNotified = v4; } catch {}
        try dd.tokensPerMint() returns (uint256 v5) { d.tokensPerMint = v5; } catch {}
        try dd.dripLM() returns (address a) { d.dripLM = a; } catch {}

        if (d.dripLM != address(0)) {
            IBiggiDripLMView lm = IBiggiDripLMView(d.dripLM);
            try lm.reserve() returns (address r) { d.dripReserve = r; } catch {}
            try lm.moderatorCenter() returns (address mc) { d.dripModeratorCenter = mc; } catch {}
            try lm.reserveShareBps() returns (uint16 b1) { d.reserveShareBps = b1; } catch {}
            try lm.moderatorShareBps() returns (uint16 b2) { d.moderatorShareBps = b2; } catch {}
            try lm.sellPct() returns (uint8 sp) { d.sellPct = sp; } catch {}
            try lm.slippageBps() returns (uint256 sb) { d.slippageBps = sb; } catch {}
            try lm.txDeadlineSec() returns (uint256 dl) { d.txDeadlineSec = dl; } catch {}
            try lm.router() returns (address rr) { d.dripRouter = rr; } catch {}
            try lm.buybackAgent() returns (address ba) { d.dripBuyback = ba; } catch {}
        }
    }

    function _tokenRewardsStatus() internal view returns (TokenRewardsStatus memory t) {
        t.tokenRewards = TOKEN_REWARDS;
        ITokenRewards tr = ITokenRewards(TOKEN_REWARDS);
        try tr.rewardsCap() returns (uint256 v) { t.rewardsCap = v; } catch {}
        try tr.rewardsMinted() returns (uint256 v2) { t.rewardsMinted = v2; } catch {}
        try tr.unitReward() returns (uint256 v3) { t.unitReward = v3; } catch {}
        try tr.tokenAddress() returns (address a) { t.token = a; } catch { t.token = TOKEN; }
        try IERC20(t.token).balanceOf(TOKEN_REWARDS) returns (uint256 bal) { t.balance = bal; } catch {}
        for (uint256 i = 0; i < 11; i++) {
            try tr.blockWeight(i) returns (uint8 w) {
                t.blockWeights[i] = w;
            } catch {
                t.blockWeights[i] = 0;
            }
        }
    }
}
