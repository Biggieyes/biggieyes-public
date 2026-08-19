# CRE Simulation Evidence

- Timestamp: 2026-02-24T07:44:49.648Z
- Mode: cli
- Workflow: biggieeyes/biggieyes-vrf-postredeem/workflow.yaml
- Workflow SHA256: e7eda9358a60a8471f6e54b97b9ca9962860c18b6934e9d58b792e4c08caffae
- Status: cli_simulation_success
- Command: cre workflow simulate C:\Users\biggi\OneDrive\Obrázky\Desktop\FRONTEND\BIGGINFTWEB\biggieeyes\biggieyes-vrf-postredeem --project-root C:\Users\biggi\OneDrive\Obrázky\Desktop\FRONTEND\BIGGINFTWEB\biggieeyes --non-interactive --trigger-index 0 --evm-tx-hash 0x0000000000000000000000000000000000000000000000000000000000000000 --evm-event-index 0
- Exit code: 0

## Notes
- (none)

## Stdout
```text
✓ Workflow compiled
2026-02-24T08:44:52Z [SIMULATION] Simulator Initialized

2026-02-24T08:44:52Z [SIMULATION] Running trigger trigger=cron-trigger@1.0.0
2026-02-24T08:44:52Z [USER LOG] msg="fetching por" url=https://api.real-time-reserves.verinumus.io/v1/chainlink/proof-of-reserves/TrueUSD evms="[{TokenAddress:0x4700A50d858Cb281847ca4Ee0938F80DEfB3F1dd ReserveManagerAddress:0x51933aD3A79c770cb6800585325649494120401a BalanceReaderAddress:0x4b0739c94C1389B55481cb7506c62430cA7211Cf MessageEmitterAddress:0x1d598672486ecB50685Da5497390571Ac4E93FDc ChainName:polygon-mainnet GasLimit:1000000}]"
2026-02-24T08:44:53Z [USER LOG] msg=ReserveInfo reserveInfo="&{LastUpdated:2026-02-24 07:44:36.011 +0000 UTC TotalReserve:494515082.75}"
2026-02-24T08:44:53Z [USER LOG] msg=TotalSupply totalSupply=1000000000000000000000000
2026-02-24T08:44:53Z [USER LOG] msg=TotalReserveScaled totalReserveScaled=494515082750000000000000000
2026-02-24T08:44:53Z [USER LOG] msg="Getting native balances" address=0x4b0739c94C1389B55481cb7506c62430cA7211Cf tokenAddress=0x4700A50d858Cb281847ca4Ee0938F80DEfB3F1dd
2026-02-24T08:44:53Z [USER LOG] msg="Native token balance" token=0x4700A50d858Cb281847ca4Ee0938F80DEfB3F1dd balance=0
2026-02-24T08:44:53Z [USER LOG] msg="Updating reserves" totalSupply=1000000000000000000000000 totalReserveScaled=494515082750000000000000000
2026-02-24T08:44:53Z [USER LOG] msg="Writing report" totalSupply=1000000000000000000000000 totalReserveScaled=494515082750000000000000000
2026-02-24T08:44:53Z [USER LOG] msg="Write report succeeded" response="tx_status:TX_STATUS_SUCCESS receiver_contract_execution_status:RECEIVER_CONTRACT_EXECUTION_STATUS_SUCCESS transaction_fee:{}"
2026-02-24T08:44:53Z [USER LOG] msg="Write report transaction succeeded at" txHash=0x0000000000000000000000000000000000000000000000000000000000000000

✓ Workflow Simulation Result:
"494515082.75"

2026-02-24T08:44:53Z [SIMULATION] Execution finished signal received
2026-02-24T08:44:53Z [SIMULATION] Skipping WorkflowEngineV2
```

## Stderr
```text
Initializing...
! Using default private key for chain write simulation. To use your own key, set CRE_ETH_PRIVATE_KEY in your .env file or system environment.
Checking RPC connectivity...
Compiling workflow...
```
