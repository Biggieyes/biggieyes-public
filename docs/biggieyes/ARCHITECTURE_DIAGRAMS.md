# Architecture Diagrams

## 1. System Architecture

```text
                           +--------------------+
                           |   Frontend DApp    |
                           | React + ethers v6  |
                           +---------+----------+
                                     |
                    +----------------+----------------+
                    |                                 |
             read-only RPC                       wallet signer
                    |                                 |
                    v                                 v
       +-------------------------+         +----------------------+
       | Reader Contracts        |         | User Write Paths     |
       | Main / Tokenomics / etc |         | mint / redeem / claim|
       +-----------+-------------+         +----------+-----------+
                   |                                    |
                   +----------------+-------------------+
                                    |
                                    v
      +----------------+    +---------------+    +---------------------+
      | BiggiEyesMain  |<-->|   VRFRouter   |<-->| Chainlink VRF       |
      | ticket + VRF   |    +---------------+    +---------------------+
      +--------+-------+
               |
               | 60% native mint share
               v
      +----------------------------+
      | Distributor                |
      | fixed routing + pending    |
      +---+-----------+--------+---+
          |           |        |
          |           |        +--------------------+
          |           |                             |
          v           v                             v
 +----------------+ +----------------+   +---------------------+
 | Collection     | | Reserve        |   | BuybackAgent        |
 | Rewards        | | BIGGI + POL    |   | DEX buybacks        |
 +----------------+ +--------+-------+   +----------+----------+
                             |                      |
                             v                      v
                    +----------------+      +-------------------+
                    | Liquidity      |      | Treasury          |
                    | Manager        |      | BIGGI redistribution|
                    +-------+--------+      +----+---------+----+
                            |                  |         |     |
                            v                  v         v     v
                    +----------------+   +---------+ +------+ +----------------+
                    | LiquidityVault |   | Token   | |Reserve| | DripDistributor|
                    | LP custody     |   | Rewards | | refill| | drip inventory |
                    +----------------+   +---------+ +------+ +--------+-------+
                                                                      |
                                                                      v
                                                          +-----------------------+
                                                          | DripLiquidityManager  |
                                                          | token-to-native rail  |
                                                          +-----------+-----------+
                                                                      |
                                                                      v
                                                          +-----------------------+
                                                          | Community sinks       |
                                                          | reserve / moderator   |
                                                          +-----------------------+
```

## 2. Tokenomics Flow

```text
User mint payment
      |
      +--> 40% -> Development wallet
      |
      +--> 60% -> Distributor
                    |
                    +--> 25% -> CollectionRewards  (15% of gross mint)
                    +--> 35% -> Reserve            (21% of gross mint)
                    +--> 20% -> BuybackAgent       (12% of gross mint)
                    +--> 10% -> Treasury           ( 6% of gross mint)
                    +--> 10% -> CommunityCenter    ( 6% of gross mint)

BuybackAgent BIGGI output
      |
      v
Treasury
  |
  +--> 34% -> TokenRewards
  +--> 33% -> Reserve
  +--> 33% -> DripDistributor

BIGGI hard cap
  |
  +--> 600M reserve allocation
  +--> 200M drip allocation cap
  +--> 200M token rewards cap
```

## 3. Mint Flow

```text
User
 |
 +--> connect wallet
 |
 +--> choose mint path
       |
       +--> Main collection ticket mint
       |      |
       |      +--> pay POL or BIGGI
       |      +--> revenue routed
       |      +--> ticket ERC721 minted
       |      +--> ticket price increases
       |
       +--> Public collection mint
              |
              +--> choose pre-seeded NFT index
              +--> read current block price from main collection
              +--> pay POL or BIGGI
              +--> revenue routed
              +--> NFT minted directly
```

## 4. Redeem Flow

```text
User owns ticket
    |
    +--> redeemTicketAndMintNFT(ticketId)
            |
            +--> validate ownership and supply
            +--> burn ticket
            +--> request randomness from VRFRouter
            |
            v
      Chainlink VRF request pending
            |
            v
      VRFRouter receives random word
            |
            +--> call fulfillRandomFromRouter(requestId, randomWord)
                     |
                     +--> choose random unminted NFT index
                     +--> assign block / background / pricing context
                     +--> mint final NFT to user
                     +--> clear pending request state
```

## 5. Liquidity Flow

```text
Mint revenue / BIGGI inflow
          |
          v
        Reserve
   +------+------+
   | POL         |
   | BIGGI       |
   +------+------+
          |
          +--> requestTopUpToLM / auto trigger
                    |
                    v
             LiquidityManager
                    |
                    +--> quote BIGGI needed
                    +--> pull BIGGI from reserve
                    +--> pull POL from reserve
                    +--> add liquidity on DEX
                    +--> LP minted to LiquidityVault
                    |
                    v
              LiquidityVault
              protocol-owned LP
```

## 6. Reward Distribution Flow

```text
                  +------------------+
                  |   BIGGI Token    |
                  +---------+--------+
                            |
            initial distribute / refill / treasury splits
                            |
          +-----------------+------------------+
          |                                    |
          v                                    v
 +--------------------+              +----------------------+
 | TokenRewards       |              | DripDistributor      |
 | weekly BIGGI claims|              | drip availability    |
 +---------+----------+              +----------+-----------+
           |                                    |
           v                                    v
        NFT holder                      DripLiquidityManager
                                                  |
                                                  v
                                       reserve + community sinks

Native mint routing
      |
      v
 +--------------------+
 | CollectionRewards  |
 | orange / block /   |
 | rainbow claims     |
 +---------+----------+
           |
           v
        collector

Community allocations
      |
      v
 +--------------------+
 | CommunityCenter    |
 | event prize claims |
 +---------+----------+
           |
           v
       event winners
```
