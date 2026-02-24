# BiggiEyes Submission Checklist

Last updated: 2026-02-24

## Requirement status
- Project description that covers use case and stack/architecture: `DONE`
  - [README.md](./README.md)
  - [docs/OVERVIEW.md](./docs/OVERVIEW.md)
  - [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
  - [docs/ARCHITECTURE_DIAGRAM.md](./docs/ARCHITECTURE_DIAGRAM.md)
- 3-5 minute publicly viewable video showing workflow execution: `TODO`
  - Add URL here: `TODO`
- Publicly accessible source code (public repo): `TODO`
  - Add public repo URL here: `TODO`
- README links to all files that use Chainlink: `DONE`
  - [docs/chainlink-file-index.md](./docs/chainlink-file-index.md)
- Follow sponsor-specific prize rules: `IN PROGRESS`
  - [docs/sponsor-prize-checklist.md](./docs/sponsor-prize-checklist.md)
- Build/simulate/deploy CRE workflow used in project: `DONE (SIMULATED)`
  - Workflow project root: [biggieeyes/project.yaml](../biggieeyes/project.yaml)
  - Workflow folder: [biggieeyes/biggieyes-vrf-postredeem](../biggieeyes/biggieyes-vrf-postredeem)
  - Simulation evidence: [evidence/cre-simulation/cre-cli-success-latest.md](./evidence/cre-simulation/cre-cli-success-latest.md)
  - Raw CLI log: [evidence/cre-simulation/cre-cli-success-2026-02-24T05-42-37Z.log](./evidence/cre-simulation/cre-cli-success-2026-02-24T05-42-37Z.log)
- Workflow integrates blockchain + external API/system/LLM/AI and demonstrates successful CRE simulation or live deployment: `DONE (SIMULATION)`
  - Simulated trigger: `cron-trigger@1.0.0`
  - External API in workflow run: `https://api.real-time-reserves.verinumus.io/v1/chainlink/proof-of-reserves/TrueUSD`
  - Blockchain interaction in simulation: `ethereum-testnet-sepolia` via EVM capability

## Runbook for evidence generation
1. Configure env vars:
   - `AMOY_RPC_URL`
   - `VRF_ROUTER_ADDRESS`
   - `EXTERNAL_SIGNAL_URL`
2. Dry-run evidence:
   - `node scripts/cre/simulate-cre-workflow.mjs --dry-run`
3. CLI simulation evidence (when CRE CLI is installed):
   - `node scripts/cre/simulate-cre-workflow.mjs`
4. Collect generated files from:
   - `evidence/cre-simulation/`
