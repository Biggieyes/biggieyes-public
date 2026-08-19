// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* ---------- ERC20 ---------- */
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
    function name() external view returns (string memory);
}

/* ---------- BiggiEyesMain – výřezy ---------- */
interface IBiggiMainView {
    function ticketPrice() external view returns (uint256);
    function ticketMinted() external view returns (uint16);
    function biggiMinted() external view returns (uint16);
    function getCurrentBlockPrice(uint16 blockIdx) external view returns (uint256);
    function blockMintCounts(uint256 i) external view returns (uint16);
    function backgroundMintCounts(uint256 i) external view returns (uint16);
    function characterClaimed(uint16 blk) external view returns (bool);
    function exists(uint256 tokenId) external view returns (bool);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

/* ---------- Reader ---------- */
interface IBiggiReader {
    function getMintDataByTokenId(uint256 tokenId) external view returns (uint256, uint256, uint256);
}

/* ---------- Treasury (policy preview) ---------- */
interface IBiggiTreasuryView {
    function previewPolicySplit(uint256 amount) external view returns (
        uint256 burnAmt, uint256 stakingAmt, uint256 reserveAmt, uint256 keptLocked
    );
    function lpRecipient() external view returns (address);
}

/* ---------- Policy ---------- */
interface IBiggiPolicyView {
    function betaBurnBps() external view returns (uint256);
    function gammaStakingBps() external view returns (uint256);
    function deltaReserveBps() external view returns (uint256);
    function lpSlippageBps() external view returns (uint256);
    function txDeadlineSec() external view returns (uint256);
}

/* ---------- VRF router ---------- */
interface IBiggiVRFRouterView {
    function coordinator() external view returns (address);
    function keyHash() external view returns (bytes32);
    function subId() external view returns (uint256);
    function callbackGasLimit() external view returns (uint32);
    function requestConfirmations() external view returns (uint16);
    function numWords() external view returns (uint32);
    function main() external view returns (address);
    function reqMinter(uint256 requestId) external view returns (address);
    function reqTicket(uint256 requestId) external view returns (uint256);
}

/* ---------- LiquidityPool (LP kontrakt) ---------- */
interface IBiggiLiquidityPoolView {
    /* adresy */
    function biggiToken() external view returns (address);
    function router() external view returns (address);
    function wrappedNative() external view returns (address);
    function liquidityRecipient() external view returns (address);
    /* parametry LP */
    function lpUseBalanceBps() external view returns (uint256);
    function swapSlippageBps() external view returns (uint256);
    function lpAddSlippageBps() external view returns (uint256);
    function txDeadlineSeconds() external view returns (uint256);
    /* info zůstatků kontraktu (pokud existují view helpery) – volitelné */
    // function contractEthBalance() external view returns (uint256);
}

/* ---------- Liquidity (staking kontrakt) ---------- */
interface IBiggiLiquidityStakingView {
    /* staking core */
    function totalStaked() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256); // uživatelský stake
    function earned(address account) external view returns (uint256);    // pending odměny
    /* metriky odměn – pokud tvůj kód má */
    function rewardRate() external view returns (uint256);
    function periodFinish() external view returns (uint256);
    function lastUpdateTime() external view returns (uint256);
    /* identita tokenů – pokud je vystavuje */
    function stakingToken() external view returns (address);
    function rewardsToken() external view returns (address);
}

/* ========================= FrontendHub ========================= */
contract BiggiFrontendHub {
    IBiggiMainView            public main;
    IBiggiReader              public reader;            // optional
    IBiggiTreasuryView        public treasury;          // optional
    IBiggiPolicyView          public policy;            // optional
    IBiggiVRFRouterView       public vrfRouter;         // optional
    IBiggiLiquidityPoolView   public liqPool;           // optional  (LP kontrakt)
    IBiggiLiquidityStakingView public liqStaking;       // optional  (staking kontrakt)
    IERC20                    public biggiToken;        // optional

    constructor(
        address main_,
        address reader_,
        address treasury_,
        address policy_,
        address vrfRouter_,
        address liqPool_,       // BiggiLiquidityPool
        address liqStaking_,    // BiggiLiquidity (staking)
        address biggiToken_
    ) {
        require(main_ != address(0), "MAIN_ZERO");
        main = IBiggiMainView(main_);

        if (reader_      != address(0)) reader      = IBiggiReader(reader_);
        if (treasury_    != address(0)) treasury    = IBiggiTreasuryView(treasury_);
        if (policy_      != address(0)) policy      = IBiggiPolicyView(policy_);
        if (vrfRouter_   != address(0)) vrfRouter   = IBiggiVRFRouterView(vrfRouter_);
        if (liqPool_     != address(0)) liqPool     = IBiggiLiquidityPoolView(liqPool_);
        if (liqStaking_  != address(0)) liqStaking  = IBiggiLiquidityStakingView(liqStaking_);
        if (biggiToken_  != address(0)) biggiToken  = IERC20(biggiToken_);
    }

    /* -------- Core snapshot -------- */
    function snapshotCore()
        external
        view
        returns (
            uint256 ticketPriceWei,
            uint16  ticketMinted,
            uint16  biggiMinted,
            uint256[10] memory blockPrices,
            uint16[10]  memory blockCounts,
            uint16[10]  memory bgCounts,
            uint8   charactersMinted
        )
    {
        ticketPriceWei = main.ticketPrice();
        ticketMinted   = main.ticketMinted();
        biggiMinted    = main.biggiMinted();

        uint8 c;
        for (uint16 i = 1; i <= 10; i++) {
            blockPrices[i-1] = main.getCurrentBlockPrice(i);
            blockCounts[i-1] = main.blockMintCounts(i-1);
            bgCounts[i-1]    = main.backgroundMintCounts(i-1);
            if (main.characterClaimed(i)) { unchecked { c++; } }
        }
        charactersMinted = c;
    }

    /* -------- Token info -------- */
    function biggiTokenInfo()
        external
        view
        returns (string memory name_, string memory symbol_, uint8 decimals_, uint256 totalSupply_)
    {
        require(address(biggiToken) != address(0), "TOKEN_UNSET");
        name_        = biggiToken.name();
        symbol_      = biggiToken.symbol();
        decimals_    = biggiToken.decimals();
        totalSupply_ = biggiToken.totalSupply();
    }

    /* -------- Policy -------- */
    function policySnapshot()
        external
        view
        returns (uint256 burnBps, uint256 stakingBps, uint256 reserveBps, uint256 lpSlipBps, uint256 txDeadlineSec)
    {
        require(address(policy) != address(0), "POLICY_UNSET");
        burnBps       = policy.betaBurnBps();
        stakingBps    = policy.gammaStakingBps();
        reserveBps    = policy.deltaReserveBps();
        lpSlipBps     = policy.lpSlippageBps();
        txDeadlineSec = policy.txDeadlineSec();
    }

    /* -------- Treasury -------- */
    function treasuryPreview(uint256 amountBiggi)
        external
        view
        returns (uint256 burnAmt, uint256 stakingAmt, uint256 reserveAmt, uint256 keptLocked, address lpRecipient)
    {
        require(address(treasury) != address(0), "TREASURY_UNSET");
        (burnAmt, stakingAmt, reserveAmt, keptLocked) = treasury.previewPolicySplit(amountBiggi);
        lpRecipient = treasury.lpRecipient();
    }

    /* -------- Reader: mint-time data -------- */
    function mintDataByTokenId(uint256 tokenId)
        external
        view
        returns (uint256 ticketPriceAtMint, uint256 blockPriceAtMint, uint256 finalPriceAtMint)
    {
        require(address(reader) != address(0), "READER_UNSET");
        return reader.getMintDataByTokenId(tokenId);
    }

    /* -------- Token exist + URI -------- */
    function tokenExistsAndURI(uint256 tokenId) external view returns (bool exists_, string memory uri) {
        exists_ = main.exists(tokenId);
        if (exists_) { uri = main.tokenURI(tokenId); }
    }

    /* -------- VRF -------- */
    function vrfConfig()
        external
        view
        returns (
            address coordinator,
            bytes32 keyHash,
            uint256 subId,
            uint32  callbackGasLimit,
            uint16  requestConfirmations,
            uint32  numWords,
            address mainAddr
        )
    {
        require(address(vrfRouter) != address(0), "VRF_UNSET");
        coordinator          = vrfRouter.coordinator();
        keyHash              = vrfRouter.keyHash();
        subId                = vrfRouter.subId();
        callbackGasLimit     = vrfRouter.callbackGasLimit();
        requestConfirmations = vrfRouter.requestConfirmations();
        numWords             = vrfRouter.numWords();
        mainAddr             = vrfRouter.main();
    }

    function vrfRequestInfo(uint256 requestId) external view returns (address minter, uint256 ticketId) {
        require(address(vrfRouter) != address(0), "VRF_UNSET");
        minter   = vrfRouter.reqMinter(requestId);
        ticketId = vrfRouter.reqTicket(requestId);
    }

    /* -------- LiquidityPool (LP kontrakt) -------- */
    function liquidityPoolCore()
        external
        view
        returns (
            address biggi,
            address router_,
            address wrapped,
            address lpRecipient_,
            uint256 lpUseBps,
            uint256 swapSlipBps,
            uint256 lpAddSlipBps,
            uint256 txDeadlineSec
        )
    {
        require(address(liqPool) != address(0), "LP_UNSET");
        biggi         = liqPool.biggiToken();
        router_       = liqPool.router();
        wrapped       = liqPool.wrappedNative();
        lpRecipient_  = liqPool.liquidityRecipient();
        lpUseBps      = liqPool.lpUseBalanceBps();
        swapSlipBps   = liqPool.swapSlippageBps();
        lpAddSlipBps  = liqPool.lpAddSlippageBps();
        txDeadlineSec = liqPool.txDeadlineSeconds();
    }

    /* -------- Liquidity (staking kontrakt) -------- */
    function stakingCore()
        external
        view
        returns (address stakingToken_, address rewardsToken_, uint256 totalStaked_)
    {
        require(address(liqStaking) != address(0), "ST_UNSET");
        stakingToken_ = liqStaking.stakingToken();
        rewardsToken_ = liqStaking.rewardsToken();
        totalStaked_  = liqStaking.totalStaked();
    }

    function stakingUser(address user)
        external
        view
        returns (uint256 userStaked_, uint256 userEarned_, uint256 rewardRate_, uint256 periodFinish_, uint256 lastUpdate_)
    {
        require(address(liqStaking) != address(0), "ST_UNSET");
        userStaked_   = liqStaking.balanceOf(user);
        userEarned_   = liqStaking.earned(user);
        rewardRate_   = liqStaking.rewardRate();
        periodFinish_ = liqStaking.periodFinish();
        lastUpdate_   = liqStaking.lastUpdateTime();
    }
}
