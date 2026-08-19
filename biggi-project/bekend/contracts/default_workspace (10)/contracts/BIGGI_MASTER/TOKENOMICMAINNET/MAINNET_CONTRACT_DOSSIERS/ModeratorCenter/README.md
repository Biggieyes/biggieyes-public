# ModeratorCenter Mainnet Dossier

## Source of truth

- Source file: `../../ModeratorCenter.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor

`constructor(address initialOwner)`

## Runtime role

`ModeratorCenter` is the moderator and referral payout contract.

It manages:

- `10` moderator slots
- per-slot leader/moderator role state
- payout addresses
- password and referral hashes
- weekly unique referral counts
- weekly ticket sale counts
- weekly allocation and distribution accounting
- milestone payout tracking

Funds enter through `notifyAllocation()` from the configured `multiCollection` address. Weekly reward distribution is owner-triggered and uses slot weights derived from unique referrals, ticket counts, and role coefficients.

## Owner/admin surface

- `configureSlot(uint8,bool,bool,address)`
- `setPasswordHash(uint8,bytes32)`
- `setReferralHash(uint8,bytes32)`
- `setPayoutAddress(uint8,address)`
- `setReporter(address,bool)`
- `setCoefs(uint256,uint256,uint256)`
- `setMilestones(uint256,uint256,uint256)`
- `setGlobalUniquePerWeek(bool)`
- `setMultiCollection(address)`
- `distributeWeekRewards()`
- `distributeWeekRewardsForWeek(uint256)`

## Integration map

- trusted reporter addresses can call `recordTicketSale(bytes32,address)`
- end users can call `registerReferral(bytes32)`
- `multiCollection` is the intended reward allocation source

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `MODERATOR_CENTER` | `0xda07a5fDee4d6d491cF31368F00e2aD584bB033D` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
