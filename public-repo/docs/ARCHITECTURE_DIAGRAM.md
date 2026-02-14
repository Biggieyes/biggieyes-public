# BiggiEyes Architecture Diagram (Mermaid)

> Note: This diagram reflects the integration seen in the front-end and common DeFi patterns. Actual on-chain wiring can vary by deployment. Dashed lines represent indirect or configurable flows.

```mermaid
flowchart LR
  %% ===== Frontend =====
  subgraph FE[Frontend (React/Vite)]
    UI[UI Panels\nLiveStats / Tokenomics / VRF / Rewards / User]
    ReaderSnap[Reader Snapshot Helper\n(getFrontendSnapshotLite*)]
    Wallet[Wallet / Signer]
    RPC[Read-only RPC]
  end

  %% ===== Core NFT =====
  subgraph CORE[Core NFT]
    Main[BiggiMain / BiggiMain2]
    VRF[BiggiVRFRouter]
    Policy[BiggiPolicy]
    Community[BiggiCommunityCenter]
    Mod[ModeratorCenter]
  end

  %% ===== Rewards =====
  subgraph REW[Rewards & Distribution]
    MCD[BiggiMultiCollectionDistributor]
    ColRewards[BiggiCollectionRewards]
    NftRewards[BiggiNftRewards]
  end

  %% ===== Tokenomics =====
  subgraph TOK[Tokenomics]
    Token[BiggiToken]
    Treasury[BiggiTreasury]
    Reserve[BiggiReserveV4]
    Buyback[BiggiBuybackAgent]
  end

  %% ===== DRIP =====
  subgraph DRIP[DRIP System]
    DripD[BiggiDRIPDistributor]
    DripK[BiggiDRIPKeeper]
    DripLM[BiggiDRIPLM]
  end

  %% ===== Liquidity =====
  subgraph LIQ[Liquidity & DEX]
    LM[BiggiLiquidityManager]
    LMAuto[LiquidityAutomation]
    LVault[LiquidityVault]
    LHelper[BiggiLiquidityHelperReader]
    LUser[BiggiLiquidityBranchUserReader]
    Router[UniswapV2Router02]
    Factory[UniswapV2Factory]
    Pair[UniswapV2Pair]
    LPFeed[BiggiLpPriceFeed]
  end

  %% ===== Frontend reads/writes =====
  UI -->|read| ReaderSnap
  UI -->|read| Main
  UI -->|write| Main
  UI -->|read| MCD
  UI -->|read| Token
  UI -->|read| Treasury
  UI -->|read| Reserve
  UI -->|read| Buyback
  UI -->|read| DripD
  UI -->|read| LHelper
  UI -->|read| LUser
  UI -->|read| LPFeed
  Wallet -->|sign tx| Main
  Wallet -->|sign tx| MCD
  Wallet -->|sign tx| LM
  Wallet -->|sign tx| Buyback
  RPC --> ReaderSnap

  %% ===== On-chain relationships =====
  Main -.->|VRF request / fulfill| VRF
  Main -.->|policy params| Policy
  MCD -->|distributes mint native (share)| ColRewards
  MCD -->|distributes mint native (share)| Community
  MCD -->|distributes mint native (share)| Treasury
  MCD -->|distributes mint native (share)| Reserve
  MCD -->|distributes mint native (share)| Buyback
  MCD -.->|optional flows| NftRewards
  Buyback -->|swap / liquidity ops| Router
  LM -->|swap / add/remove| Router
  Router --> Factory
  Router --> Pair
  LPFeed --> Pair
  LMAuto --> LM
  DripK --> DripD
  DripLM --> LM
  Treasury -.-> Buyback
  Reserve -.-> Buyback
  Community -.-> MCD
  Mod -.-> Main
```

Legend:
- Solid arrows = direct read/write calls from frontend or direct contract interactions.
- Dashed arrows = indirect or configurable flows (funding, policy, automation).

