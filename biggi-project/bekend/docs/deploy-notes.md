# Deploy & Wiring Notes (POL mainnet)

Status: historical reference only. Do not use this file as the current frontend or backend address source of truth.

Current sources of truth:

- Frontend: `src/shared/utils/addresses.js`
- Backend mirror: `biggi-project/bekend/addresses.json`
- Public frontend mirror: `public-repo/src/shared/utils/addresses.js`

The address block below records an older deployment path and is retained only for historical traceability.

Fill the addresses as you deploy. Order suggested:

1. **Core DEX**
   - Run `npx hardhat run scripts/deployDexCore.js --network <net>` to get `WETH9`, `UniswapV2Factory`, `UniswapV2Router02`.
   - Record: `WETH9=`, `Factory=`, `Router=`.

2. **Token**
   - Deploy `BiggiToken` with `initialOwner=<multisig>`.
   - Set: `setReserve`, `setDripDistributor`, `setTokenRewards`, `setMarketingSupport`, optionally `setRewardsOperator`.
   - Call `initialDistribute()` once.

3. **Treasury**
   - Deploy `BiggiTreasury` (owner = multisig, token = BIGGI).
   - Set `distributor`, `buybackAgent`, `tokenRewards`, `reserveAddr`, `dripDistributor`.
   - Distributor must send POL via `depositPolFromDistributor`.

4. **Reserve**
   - Deploy `BiggiReserveV4` (biggi, owner).
   - Set `liquidityManager`.
   - Set `distributor` (who sends POL share).

5. **Liquidity stack**
   - Deploy `LiquidityVault` (owner).
   - Deploy `BiggiLiquidityManager` (token, router, vault, owner, reserve).
   - Deploy `BiggiLiquidityOrchestrator` (reserve, lm, owner).
   - Optional: `LiquidityKeeperProxy` / `LiquidityAutomation` with thresholds.
   - Wire via `LiquiditySetup.setupReserveLMVault(factory, keeper, tokenPct, slippage, deadline, autoEnabled, triggerPol, requestPol)` and `runDexConnections(factory)` to whitelist pair.

6. **Drip**
   - Deploy `BiggiDripDistributor` (token, owner); set `dripLM`, `treasury`, collections + `tokensPerMint`.
   - Deploy `BiggiDripLMToModerator` (token, router, owner); set `dripDistributor`, `buybackAgent`, `reserve`, `moderatorCenter`, `shares` (default 50/50), `sellPct/slippage/deadline`.
   - Optional keeper proxy: `DripKeeperProxy` then `setDripLM`.

7. **Buyback**
   - Deploy `BiggiPolicy` (owner) and tune slippage/deadline/cooldown/dailyLimit.
   - Deploy `BiggiBuyBackAgent` (token, owner); set `router`, `treasury`, `policy`, `dripLM`, optional swap path.
   - Deploy `BiggiBuybackUpkeepProxy` if using automation; set `agent`, `minNativeThresholdWei`.

8. **Distributors**
   - `MultiCollectionDistributor`: set `collectionRewards/reserve/buybackAgent/treasury/communityCenter`, whitelist collections.

9. **Readers (optional)**
   - `BiggiBuybackReader`, `BiggiLiquidityBranchUserReader`, `BiggiTokenomikReader` for dashboards.
   - `BiggiMultiCollectionDistributorReader` for distributor stats.

10. **Automation / feeds / VRF (optional)**
    - `BiggiLiquidityKeeperProxy`: deploy with orchestrator + reserve, then set allowed caller/strategy/limits.
    - `BiggiBuybackUpkeepProxy`: set agent + threshold + paused flag.
    - `DripKeeperProxy`: set dripLM + keeper(s).
    - `BiggiLpPriceFeed`: deploy with BIGGI/WPOL + pair (or zero), set pair/tokens/decimals if needed.
    - `BiggiVrfRouter`: deploy with VRF coordinator + keyHash + subId, then set main contract.

Historical recorded addresses from an older Polygon mainnet deployment:
- BIGGI token: 0xD4D0fa17f2955Eb3fF8D03ea0cD7A2f0a06E6d0E
- Main (VRF): 0x3430f378032Cead7A82f38047e906C1E3cAFc703
- Main2 (public): 0xf511267b2A08Cd2f94ACc0eF74c4Eb1Ac799980B
- Treasury: 0x42f4d7091e2a23CD855b880de1676290f3E57fe4
- Reserve (legacy): 0x516aBCBd1BaD369e702E3D52eccA755E7752FDd8
- Reserve (legacy, replaced): 0xC700EA8E43259C832C2438D01F60C88752894B8f (BIGGI migrated out, POL remains locked there)
- Reserve (active): 0xa283f6D745cd858133f7a3AE6A2ea97D7b8FA54f (patched ReserveV4, dexRefill restored from previous active reserve)
- LiquidityManager: 0x87f542886FC133C68F1b0ae7737Ecb4f8F647e6C
- LiquidityVault: 0xD775DaBBa9246694F3F570D9CEC769B1b37808f5
- LiquidityOrchestrator: 0xAfbA1a91A0211a0a892dC34B529f904bF6E70c59
- DripDistributor: 0x2B835CFbF11AD44fd1A977D1781195674771ECa6
- DripLMToModerator: 0xD32fC50c153Ab47F68763c739A2deA8b5Da81373
- ModeratorCenter (CommunityCenter): 0x1aa66c77B3c7ec1eC704308a182C7f43a8744702
- BuybackAgent: 0x06fC8552119d8B46e8dd19C54c81b9E3bDEfa266
- Policy: 0xeaf0b4561CF70D130ff4E68C3558f77b432C2EC1
- MultiCollectionDistributor: 0xc8382527D0cb095fDa284547EA91eC352E7C75Cd
- NFTRewards: 0x5a0030502c9f8D4C99b17c0dFb029e3e8041f51A
- TokenRewards: 0x5Fc30c88CeA11f397ccc73d6bec020e7779D9cca
- CollectionRewards: 0xa708E016dEC7B6a5b3da640c0d995895979cE332
- DEX (Uniswap V2): WETH9=0x3A433ffd460fC9aFE9cC53fc6E43f5EBFDF9D23A, Factory=0xBB4a370EC2a8f04BCFB125C290eC8FA37B835764, Router=0xB767E3Cd07fD0Dd96827895AB8b3801A3b141e8a, Pair=0x210d5aE3e0E954836D237363Eea2674bD36e9b63
- VRF Router: 0x53cC9F2BD094f10D2cB477caE44aCBa32175db0B
- LpPriceFeed: 0xDc259aC37b8A1B33AB8B5093A6A9F21D0892F533 (pair set to BIGGI/WPOL 0x210d5aE3e0E954836D237363Eea2674bD36e9b63)
- Compute (BiggiCompute): 0xBDF1314101b006197c735054C95a5E8c49284fC2
- Automation / Keepers:
  - LiquidityKeeperProxy: 0xb47CFDE62feA7a8A4B3a569d8A6Bf83c8a9D6f10 (strategy PCT 5%, minReserve 1 POL, maxPerTx 2 POL, any caller)
  - BuybackUpkeepProxy: 0x833a208232BB157439404ba0A1898A6737986E72 (threshold 0.001 POL, keeper of BuybackAgent)
- DripKeeperProxy: 0x5ca6D9bA630265997E246A6c5d9A54b89EDf5afb (owner/keeper = deployer, dripLM wired)
- Readers:
  - BuybackReader: 0xbee52e0954a97BE91925557e615e016168F6d4b1
  - MultiCollectionDistributorReader: 0x1A1521465B4828726e2025C6f8351587A15903Cb (historical; current frontend uses `MCD_READER_V2` from `src/shared/utils/addresses.js`)
  - LiquidityBranchUserReader: 0xeE810e1948B5f1968cd27C6109219F2C2621e0a8
  - TokenomikReader: 0x6df60d74c6e187a9ad3396e3c36d60f2f432240a
  - MainReader: 0x67b58d0f241b557a75Db0EbAf27F9452aDe0B749
  - LiquidityHelperReader: 0x5FDD372008eC0475D91f465E0ED23c38E55EBeA4
  - ReserveTreasuryReader: 0x82525E67414e69788612abCb851B54193c4a8593
  - TokenRewardsReader: 0x523Fe9b6d30540144cB0bB834D0Bf8E89BFA4BF3
  - NftRewardsReader: 0xB99320A777a394bB543bbAfC85A7D11e5b6f4E61
- Multicall2: 0x55d1Bb6CdE2AF3B293fDADda12cbF5A6c367A348
```
Bootstrap liquidity & tests (Polygon mainnet, new Uniswap V2):
- Added 1 POL + 10,000 BIGGI via router 0xB767E3Cd07fD0Dd96827895AB8b3801A3b141e8a, pair 0x210d5aE3e0E954836D237363Eea2674bD36e9b63.
  - transferFromReserveTo: 0x8609f0f6ad486794ce8d39ceeb74128d543cfbae501f0b08545d76c26c01caad
  - addLiquidityETH: 0x4c790f4daee468de2062aabc0caddbe4337fc2e5e7aed571b01cd2fd5a87a515
  - LP -> LiquidityVault transfer: 0x56a3be84e9c3881ab6d103f089ff1b26450d19cf2a7ad0403b5ff851e6eab2b8
- Smoke swap 0.05 POLâ†’BIGGI ok: 0xe796b3bdffcc07da28796cfc1fe3f8aae1bf510707ba9bb889257a98399563db
- Buyback funded 0.1 POL + buybackAllToTreasury ok:
  - fund: 0xdcdf4738ee145e1f5719b9f5f3c0e4a846c6e6b936ef79db4f757dcd5f79d2d4
  - buyback: 0xbdd117d71a9e44c1d66727fac762fa78a25144fcbe9f992d9f4594fd3de2c347
Reserve migration (Polygon mainnet, 2026-02-08):
- New ReserveV4 deploy: 0xa283f6D745cd858133f7a3AE6A2ea97D7b8FA54f
- Key txs:
  - deploy: 0x328fb0dea586e736a23564f4dcd7a4969a7614122533597274166e44cae8c8b8
  - setLiquidityManager: 0x8ffa3cc7299145b68dd60d84006765353aea4e18dca68102e536a5ca5fafdfc8
  - setDistributor: 0xe66fef700897a196ffa757b76bbd707fc2c9ccfc0fa9a6cb71f56d448795dc3f
  - BIGGI migrate old->new reserve: 0x25bed1cb80e694fb72e3ed6860069879e280953019d1ef6fdc38e6dc855bbcde
  - ownerTopUpDexRefill on new reserve: 0xea5b0a228ae661daf92d57a5269b1c76fe53c36054d8c168af1c0e622efd7c8b
  - token.setReserve: 0xd39291a8a7e4d39e3f51f4d3829b46e70c7ac45d35b55bb50c9929784bc0ed25
  - treasury.setReserve: 0x49d99437e4bea4f52700f4236aa092fb3240385d7e2621fd9eab3ded7cf0de13
  - main.setReserveAddress: 0x4cb9a43a887cf3e65b766851131eee358b4b7a4de11b817fa732d050c035e37d
  - main2.setReserveAddress: 0x027725e2d10e94526b72a1a89a147f9fe6e78e720b165267018499ab145ff090
  - distributor.setReserve: 0x2bde43192cf168c098e6960eafe8568054ca4c260de5daa948093ca645e69991
  - lm.setReserve: 0xe328c7eca79c5f1aaaaac11d182fa399a77626fd554d997e980465ad4e4cccbe
  - orchestrator.setReserve: 0x0a5287b596ada02a443dc1d5477a4eefcb1cce2f441567d3c9accb5c94b8929f
  - keeper.setReserve: 0x4e907db7675018ae532ac45dfc1b18102350a35ccd100586f1c3c3b3bbbbc1f0
  - dripLM.setReserve: 0x1ff7c251d20ff7613c2efcdd5cce53ed6a554fcfb36b7359de375bc3a02a229b
  - masterConfig.setCore: 0xa96f4063e1b9a8c422cbcb72253778d093ac88db4b0d79e4929ba87499159d6d
  - reserve POL top-up (for immediate LM trigger readiness): 0x2b0fc2f95d492273bcdc02d580fe270c1654b99b3700fe6417d6e7a587d824db
LM runtime tuning after migration (to prevent addLiquidity revert on low-depth pool):
- Root cause: old config (`tokenPct=50`, `requestPol=5`, `slippage=200`) caused `LiquidityAddFailed("addLiquidity failed")`.
- Applied config:
  - `setTokenPct(100)`: 0x7af884545c577c0e18a0ecba51878b9d5380b5dc650d38ae98b4eb7b7dea192f
  - `setSlippageBps(300)`: 0x7ab05213373acc11b310ed9e780aaf58fd7b79f6a6736d8239bed3e4b890b407
  - `setAutoTopUpConfig(true, 0.05 POL, 0.05 POL)`: 0x9e919fc8531de05710253db2d72d798677244a9eb632e8a3892b19db92218d20
  - `orchestrator.setLimits(min=0.05, max=50, minDexRefill=1 BIGGI, cooldown=900, daily=0)`: 0x69bba0d433e44d1d741244b1a02b0d2ce6325e7b9050979fedfd3c08a7b77911
- Validation txs:
  - direct `LM.executePairing(0.05)`: 0xbc7c3e925eac5994b90bfe92895254dbcc9b5e00f5e0fb1e6b247b5fbc4e2d94
  - `reserve.requestTopUpToLM()` (high gas) success: 0xaa00b0b8e8e0e00836645df73651cb04b88730264c4a65994d2c5cbf3eddf8fb
```
