# Frontend / Mainnet Integration Audit Report

Last verified: 2026-08-17

This report replaces the old January report that contained historical deployed addresses and missing-reader notes. It reflects the current Polygon mainnet frontend state.

## Scope

- Frontend contract configuration.
- ABI inventory and frontend ABI usage.
- Reader contract addresses consumed by dashboards.
- Runtime smoke checks for mainnet user-facing panels.
- Serverless documentation assumptions.

This report does not claim a formal independent Solidity security audit.

## Current Mainnet Addresses

Authoritative source: `src/shared/utils/addresses.js`.

Selected live values:

| Key | Address |
| --- | --- |
| `MAIN` / `COLLECTION_VRF` | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` |
| `MAIN2` / `COLLECTION_PUBLIC` | `0xe56cC0657A89daf10994204eD745985a61b0E36F` |
| `TICKET_HUB` | `0x7b7e561173f498C8274b821090Da64E8ee653f6A` |
| `VRF_ROUTER` | `0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F` |
| `BIGGI` | `0xD73152845Bc5a9b8253ea0100BB10388CC5c0EeD` |
| `DISTRIBUTOR` | `0xCE892698159D8D799D5eF7f0dF0111487511fD22` |
| `RESERVE` | `0x2786e46e01a5d229118fEdC102267217C7e94574` |
| `TREASURY` | `0x35EE9523D20fFfe47c62dCcF01fA0136424A05e7` |
| `BUYBACK_AGENT` | `0x5A77E90c467576C82B8d0E74eD112B829C625BB4` |
| `COLLECTION_REWARDS` | `0x5d1273070c9133381C570009768621762F024FB8` |
| `TOKEN_REWARDS` | `0xA455775BBe0BC863f644516147b95Ef5103b29FA` |
| `NFT_REWARDS` | `0x939Df533b80943298E15ad4c8F188102954f34FF` |
| `PAIR` | `0x59C7B17B3ACD48979B25215a0c477dF6FFFF3e90` |

## Reader Addresses

| Key | Address |
| --- | --- |
| `MAIN_READER` | `0x4937CdcF1668255Cb46c78E19547ea96C94391Ef` |
| `MCD_READER_V2` | `0xa65B4e88E37F085B9009295eA0AcF05e18a82884` |
| `NFT_REWARDS_READER` | `0x430376b1f4F12ce2D641CC28f2968297aA2b0c12` |
| `TOKEN_REWARDS_READER` | `0xB558137Ce8a2e065de09f7ef7cF24911E49A9972` |
| `RESERVE_TREASURY_READER` | `0xb379bB928f3B683528C209C28A95F4D2854EC407` |
| `BUYBACK_READER` | `0x8eD6c94e5Fb336096E6C28480f3C514c9bddFa89` |
| `BIGGI_TOKENOMICS_READER` | `0x868640D9fd873AE3ecFCAbCbB458413A70D6f468` |
| `TOKENOMICS_SYSTEM_ADDON_READER` | `0x28D73361F9E7778362cac9fEBe1c8E0a2B1121ea` |
| `SYSTEM_READER` | `0x5C918B2E610BAF3E9f77B0b7dE456D63B7F8bD55` |
| `LM_READER` | `0x1879b76c3a923d58970a90e3D004bD067c272a22` |
| `LIQUIDITY_BRANCH_USER_READER` | `0xC04FC52560fe5A8fcEf16a3ADE7126e83Da0D4f5` |
| `MULTICALL` | `0x70bc315E4E5548e54F358Abf4515C1bB1551687b` |

## Verification Results

Latest checked state:

- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm test`: passed, 32 files / 72 tests
- `npm run check:contracts`: passed, 161 runtime frontend/backend keys, five chapters and seven canonical CORE ABI comparisons; historical `OLD_TICKET_HUB` is backend-only
- `npm run check:abis`: passed, 58 ABI files / 801 functions
- `npm run check:rpc`: passed, 2/2 healthy RPC endpoints
- `npm run smoke:runtime`: passed Gallery, LiveStats, and Rewards

## Risks And Follow-Up

- Use a reliable private RPC for production traffic; public RPCs may rate-limit.
- Keep Netlify/Supabase/Pinata secrets server-side only.
- Continue running ABI and address checks after every contract deployment or ABI sync.
- A third-party smart-contract audit remains a separate requirement before high-value public operation.
