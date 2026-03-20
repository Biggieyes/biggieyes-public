# Frontend Architecture

## Stack

| Layer | Technology |
| --- | --- |
| UI | React 19 |
| Bundler | Vite |
| Web3 library | ethers v6 |
| Wallet connectivity | injected wallets + WalletConnect |
| Serverless integration | Netlify functions |
| Monitoring-ready hooks | RPC health, transparency snapshots, VRF polling |

## Application Structure

The frontend is built as a dashboard-style DApp with lazy-loaded panels for heavy protocol views.

### Primary Panels

- `EcosystemPanel`
- `COLLECTIONBlocksGrid`
- `REWARDSPanel`
- `VRFPanel`
- `USERPANEL`
- `COMMUNITYCENTERPanel`
- `AdminPanel`

These are orchestrated from `src/app/AppCore.jsx`.

## Data Access Pattern

### Reader-First Strategy

The app prefers dedicated reader contracts and snapshot helpers over raw multi-contract fan-out where possible. This pattern reduces frontend complexity and lowers RPC load.

Core access points include:

- `getFrontendSnapshotLiteActive()`
- `getReaderRO()`
- `getBiggiMainReaderRO()`
- `getBiggiTokenomicsReaderRO()`
- specialized reserve, treasury, drip, and rewards readers

### Fallback Strategy

If a reader path fails, the frontend can reconstruct key state directly from the underlying main contract and related primitives. This provides graceful degradation during reader deployment or ABI drift incidents.

## Contract Registry

The canonical address map lives in:

- `src/shared/utils/addresses.js`
- `biggi-project/bekend/addresses.json`

The frontend enforces a curated address allowlist rather than dynamically trusting arbitrary env-injected values.

## Provider Model

### Read Providers

The app builds read providers from:

- configured private RPC endpoints
- public Polygon Amoy endpoints
- optional ethers `FallbackProvider`
- optional injected provider on the correct chain

RPC health selection and preference storage are handled in `src/shared/utils/rpcConfig.js`.

### Signer Providers

Write flows use:

- browser-injected wallets through `BrowserProvider`
- WalletConnect through `@walletconnect/ethereum-provider`

The app also includes best-effort network synchronization and `wallet_addEthereumChain` / `wallet_switchEthereumChain` flows for Polygon Amoy.

## Wallet UX

The frontend supports:

- injected wallet discovery
- WalletConnect QR and mobile deep-link flows
- mobile wallet fallback handling
- explicit chain enforcement for Polygon Amoy
- session reload on chain or account changes

## State Domains

The UI groups on-chain state into a few primary domains:

| Domain | Example Sources |
| --- | --- |
| Mint state | main reader snapshot, ticket lookup, block price arrays |
| VRF state | VRF router, pending request trackers, polling helpers |
| Rewards state | token rewards reader, collection rewards service |
| Tokenomics state | tokenomics full status reader normalization |
| Transparency state | balance checks, policy snapshot, RPC latency |
| Community state | event readers and claim status |

## Performance Techniques

- lazy loading of heavy panels
- local caching for gallery metadata
- reader aggregation instead of repeated point reads
- polling helpers and lock utilities for long-running refresh loops
- fallback provider reuse to avoid repeated initialization

## Frontend Security Considerations

- signer access is limited to explicit write flows
- read-only provider paths are preferred for dashboard rendering
- chain enforcement reduces accidental execution on the wrong network
- RPC health logic de-prioritizes stale or rate-limited endpoints
- environment-driven secret handling remains server-side for pinning and admin functions

## Key Implementation Files

| File | Responsibility |
| --- | --- |
| `src/app/AppCore.jsx` | app shell and panel orchestration |
| `src/shared/utils/contract.js` | contract factory and provider helpers |
| `src/shared/utils/addresses.js` | canonical address registry |
| `src/shared/utils/rpcConfig.js` | RPC health, preference, and network data |
| `src/web3/provider.js` | fallback provider access |
| `src/wallet/wc.js` | WalletConnect session management |
| `src/hooks` | protocol-specific hooks for reserve, treasury, rewards, drip, and buyback |

For write-path details and UI interaction specifics, see [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md).
