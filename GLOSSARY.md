# Glossary

## A

**Amoy**  
Polygon testnet network with chain ID `80002`, used by the current public registry in this repo.

**Auto buyback**  
Automated DEX purchase of BIGGI using protocol-controlled native value.

## B

**Background**  
One of the ten visual trait families used by BIGGIEYES NFTs.

**BIGGI**  
The ERC20 utility token powering rewards, reserve replenishment, treasury routing, and drip logic.

**Block**  
A numbered rarity or category band in the BIGGIEYES NFT system. Each NFT belongs to one of ten blocks.

**BuybackAgent**  
The contract that swaps native value for BIGGI and forwards acquired tokens to treasury.

## C

**Chainlink VRF**  
Verifiable randomness infrastructure used to assign NFTs fairly after ticket redemption.

**Collection reward**  
A native-token payout triggered by completing an on-chain ownership set.

**CommunityCenter**  
The contract that escrows event prizes and allows winners to claim assigned native-token amounts.

## D

**DEX refill**  
Reserve bucket used to store BIGGI earmarked for liquidity operations.

**Distributor**  
The contract that routes approved collection mint revenue into fixed protocol destinations.

**Drip**  
The protocol rail that manages BIGGI inventory and converts part of it into downstream ecosystem value.

**DripDistributor**  
The contract that tracks drip BIGGI balances, caps, and claimable availability.

**DripLiquidityManager**  
The contract that sells drip BIGGI for native value and routes proceeds into reserve and community-style sinks.

## E

**Effective gross mint share**  
The share of total mint value each protocol sink receives after applying the collection-to-distributor split and the distributor split.

## F

**Final price**  
NFT-specific economic value stored at mint time, derived from block price plus background bonus logic.

## K

**Keeper**  
An authorized automation actor or proxy that triggers scheduled protocol actions.

## L

**LiquidityManager**  
The contract that pairs reserve assets and adds liquidity through the DEX router.

**LiquidityVault**  
The contract that stores protocol-owned LP tokens.

**LP token**  
Liquidity provider token representing pooled liquidity on a DEX pair.

## M

**Main ID**  
A core NFT identity index used in collection completion logic.

**Multisig**  
A multi-signature wallet used to secure privileged ownership functions in production deployments.

## N

**Native token**  
The gas token of the chain, referred to as POL on Polygon in this documentation.

**NFT index**  
The internal metadata slot from which a token ID is derived.

## P

**Pending forward**  
A distributor balance that failed to reach its destination and is held for retry.

**Permit**  
EIP-2612 style signature-based token approval supported by BIGGI.

**Policy**  
A contract that stores buyback timing, slippage, and quota guardrails.

## R

**Reader contract**  
A read-only contract that aggregates state from multiple protocol contracts into a frontend-friendly snapshot.

**Redeem**  
The act of burning a ticket to request a random NFT assignment.

**Reserve**  
The contract that stores native and BIGGI balances used for liquidity operations and reserve accounting.

## S

**Set completion**  
Ownership state that satisfies a collection reward condition such as all backgrounds for one main ID or all main IDs in a block.

**Slippage**  
The tolerated execution variance between quoted and realized swap output.

## T

**Ticket**  
A tradable ERC721 entry asset that must be burned to receive a random NFT from the main collection.

**TokenRewards**  
The contract that distributes weekly BIGGI rewards to eligible NFT holders.

**Treasury**  
The contract that receives BIGGI from buybacks and redistributes it across protocol rails.

## V

**Vault**  
Custody contract for LP assets or other protocol-held positions.

**VRFRouter**  
The dedicated contract that handles Chainlink VRF requests and fulfillment callbacks for the main collection.

## W

**Weekly claim**  
A reward claim cycle in which each eligible token can only contribute once per week inside `TokenRewards`.
