# ModeratorCenter Mainnet Dossier

## Source of truth
- Source: $(@{Name=ModeratorCenter; Source=ModeratorCenter.sol; Abi=ABI/ModeratorCenter.abi.json; Role=Referral and moderator reward accounting center with weekly allocation and milestone payouts.; Delta=Mainnet integration adds direct MultiCollection allocation intake and weighted weekly distribution logic.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Source)
- ABI package source: $(@{Name=ModeratorCenter; Source=ModeratorCenter.sol; Abi=ABI/ModeratorCenter.abi.json; Role=Referral and moderator reward accounting center with weekly allocation and milestone payouts.; Delta=Mainnet integration adds direct MultiCollection allocation intake and weighted weekly distribution logic.; Integrations=System.Object[]; Privileged=System.Object[]; Focus=System.Object[]}.Abi)

## Role
Referral and moderator reward accounting center with weekly allocation and milestone payouts.

## Mainnet delta vs testnet
Mainnet integration adds direct MultiCollection allocation intake and weighted weekly distribution logic.

## Critical integrations
- BiggiMultiCollectionDistributor
- Ticket reporters
- Community payout addresses

## Privileged actions
- Owner configures slots, reporters, and coefficients
- Trusted MultiCollection notifies payable allocation
- Owner executes weekly distribute

## Mainnet readiness gates
1. Final owner or multisig ownership transfer completed.
2. Final production addresses and parameters loaded.
3. Smoke tests and reader consistency checks pass.
4. Explorer verification and ABI freeze completed.
