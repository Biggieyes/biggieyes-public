# BiggiToken Mainnet Dossier

## Source of truth

- Source file: `../../BiggiToken.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor

`constructor(address initialOwner)`

The contract is `ERC20`, `ERC20Burnable`, `ERC20Permit`, `Pausable`, and `Ownable`.

## Runtime role

`BiggiToken` is the root BIGGI ERC20 for the tokenomic branch.

It controls:

- the hard cap through `BiggiCapsLib.BIGGI_TOTAL_SUPPLY`
- initial branch distribution via `initialDistribute()`
- reserve, drip, rewards, and marketing destination wiring
- bounded controller and guardian mint paths

Initial distribution mints to four destinations:

- `reserveAddr`
- `dripDistributorAddr`
- `tokenRewardsAddr`
- `marketingSupportAddr`

After `initialDistribute()`, `reserveAddr` becomes locked.

## Main write paths

- `initialDistribute()`: one-time cap-based initial mint
- `mint(address,uint256)`: owner mint under global cap
- `mintToDripDistributor(uint256)`: supply authority mint under guardian DEX cap
- `mintToTokenRewards(uint256)`: supply authority mint under guardian rewards cap
- `refillRewardsIfBelow(uint256,uint256)`: rewards operator top-up helper, counted against the same guardian rewards budget as controller rewards refills

## Owner/admin surface

- `setReserve(address)`
- `setDripDistributor(address)`
- `setTokenRewards(address)`
- `setMarketingSupport(address)`
- `setRewardsOperator(address)`
- `setSupplyController(address)`
- `setSupplyGuardian(address)`
- `setGuardianMintPaused(bool)`
- `pause()`
- `unpause()`
- `rescueERC20(address,address,uint256)`

## Integration map

- `BiggiDripDistributor` receives initial drip mint and later controller/guardian drip mints
- `BiggiSupplyController` and `BiggiSupplyGuardian` share supply authority for bounded mint branches
- `BiggiTokenRewards` receives token rewards branch minting
- `BiggiReserveV4` holds reserve allocation and receives reserve-side liquidity support

Mainnet note: keep `rewardsOperator` unset unless this helper is intentionally used. If configured, it cannot bypass `GUARDIAN_REWARDS_MINT_CAP` and increments `guardianRewardsMinted`.

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `BIGGI_TOKEN` | `0xD73152845Bc5a9b8253ea0100BB10388CC5c0EeD` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
