# BiggiCollectionRewards — Technical Specification

## Source of truth

- Contract: `BiggiCollectionRewards.sol`
- Solidity version: `^0.8.24`
- Base inheritance:
  - `Ownable`
  - `ReentrancyGuard`

## Purpose

`BiggiCollectionRewards` is a native-token reward distribution contract for BiggiEyes NFT collections.

The contract distributes fixed POL rewards for collection completion milestones.

The system supports:
- multiple NFT collections
- optional registry-based collection validation
- per-collection accounting
- one-time reward claims
- capped reward winners
- direct native-token payouts

---

## Reward Types

## 1. Orange Reward

Reward for completing all background variants for a specific `mainId` within a block.

### Reward amount

- `2000 POL`

### Eligibility

Caller must:
- own all background variants for a specific `mainId`
- satisfy collection eligibility validation

### Limits

- maximum 10 orange rewards per collection
- each `mainId` can only be rewarded once per collection

### Claim function

```solidity
claimOrangeRewardFor(address collection, uint256 mainId)
```

---

## 2. Block Reward

Reward for completing all ten main IDs inside a specific block.

### Reward amount

- `5000 POL`

### Eligibility

Caller must:
- own all ten NFTs within the target block
- satisfy collection eligibility validation

### Limits

- maximum 9 block rewards per collection
- each block can only be rewarded once per collection

### Claim function

```solidity
claimBlockRewardFor(address collection, uint16 blockIdx)
```

---

## 3. Rainbow Reward

Global completion reward for a collection.

### Reward amount

- `20000 POL`

### Eligibility

Caller must:
- satisfy full collection completion logic defined by the connected collection contract
- satisfy collection eligibility validation

### Limits

- can only be claimed once globally per collection

### Claim function

```solidity
claimRainbowRewardFor(address collection)
```

---

# Core State Variables

## Administrative

```solidity
address public distributor;
address public registry;
address public defaultMain;
```

### distributor

Authorized funding address for mint-share deposits.

### registry

Optional collection registry used for eligibility validation.

### defaultMain

Fallback collection used by legacy/internal flows.

---

# Reward Configuration

```solidity
uint256 public orangeReward  = 2000 ether;
uint256 public blockReward   = 5000 ether;
uint256 public rainbowReward = 20000 ether;
```

All rewards are denominated in native chain currency.

---

# Claim Tracking

## Orange reward tracking

```solidity
mapping(address => mapping(uint256 => bool)) public orangeMainIdPaid;
```

Tracks rewarded `mainId` values per collection.

---

## Block reward tracking

```solidity
mapping(address => mapping(uint16 => bool)) public blockPaid;
```

Tracks rewarded blocks per collection.

---

## User block claims

```solidity
mapping(address => mapping(address => mapping(uint16 => bool))) public userClaimedBlock;
```

Tracks whether a user already claimed a specific block reward.

---

## Winner counters

```solidity
mapping(address => uint8) public orangeWinnersCount;
mapping(address => uint8) public blockWinnersCount;
```

Per-collection reward caps.

---

## Rainbow completion tracking

```solidity
mapping(address => bool) public rainbowRewardClaimedGlobal;
```

Tracks whether rainbow reward was already claimed for a collection.

---

# Funding Model

The contract stores and distributes native POL.

## Funding entrypoints

### Distributor-only funding

```solidity
depositMintShareFromDistributor()
```

Restrictions:
- callable only by configured distributor
- payable
- amount must be non-zero

---

### Public funding

```solidity
receiveMintShare()
```

Restrictions:
- payable
- amount must be non-zero

---

# Eligibility System

The contract uses:

```solidity
BiggiCollectionEligibilityLib
```

Eligibility can operate in two modes:

## Registry mode

If registry is configured:
- collection must be validated through registry logic

## Direct mode

If registry is cleared:
- contract falls back to direct collection validation

---

# External Collection Interface

The contract interacts with collection contracts through:

```solidity
interface IBiggiEyesMainView
```

Required external functions:

```solidity
exists(uint256 tokenId)
hasAllTenMainIdsInBlock(address owner, uint16 blk)
hasAllBackgroundsForMainIdInBlock(address owner, uint16 blk, uint256 mainId)
```

---

# Administrative Functions

## Distributor management

```solidity
setDistributor(address newDistributor)
```

---

## Registry management

```solidity
setRegistry(address newRegistry)
clearRegistry()
```

---

## Main collection management

```solidity
setMain(address newMain)
```

---

# Read Functions

## Reward previews and eligibility

```solidity
canClaimOrangeFor(...)
canClaimBlockFor(...)
canClaimRainbowFor(...)
```

Used by frontend and reader contracts.

---

## Snapshot helper

```solidity
rewardsSnapshot()
```

Returns current reward configuration and counters.

---

# Security Properties

## Reentrancy protection

All payout flows are protected with:
```solidity
ReentrancyGuard
```

---

## Ownership protection

Administrative operations are restricted through:
```solidity
Ownable
```

---

## Native transfer protection

Failed native payouts revert with:
```solidity
PaymentFailed()
```

---

## Events

```solidity
OrangeRewardClaimed
BlockRewardClaimed
RainbowRewardClaimed
DistributorSet
RegistrySet
MainSet
MintShareReceived
```

---

## Error Types

```solidity
NotEnoughBalance
AlreadyClaimed
InvalidIndex
PaymentFailed
ZeroAddress
NotDistributor
AmountZero
NotEligible
InvalidCollection
```

---

## Mainnet Notes

## Deployment references

### addresses.json

- COLLECTION_REWARDS:
  `0xa708E016dEC7B6a5b3da640c0d995895979cE332`

- COLLECTION_REWARDS_MAIN_ADAPTER:
  `0x8984EFc3a4916e5C59D71480F4931326cfF7e552`

- COLLECTION_REWARDS_READER:
  `0x1A1521465B4828726e2025C6f8351587A15903Cb`

---

### addresses.master.json

- COLLECTION_REWARDS:
  `0xC9481A6935698050E569AcD70078DAD8303871CF`

- REGISTRY:
  `0x6D31CEaaa0588A62fFb99eCa3Bde0F22Bd7DBb7B`
