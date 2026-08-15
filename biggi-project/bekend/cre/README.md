# BIGGI CRE read-only health workflow

This directory contains a read-only Polygon mainnet health workflow used for local
CRE simulation and launch checks. It does not submit reports, call
`writeReport`, or perform tokenomics writes.

The canonical production CRE automation project is
[../cre-workflows/biggi-cre/README.md](../cre-workflows/biggi-cre/README.md).

Use this health workflow only to confirm live tokenomics state before wiring or
activation decisions:

```powershell
cd biggi-project\bekend\cre
cre workflow simulate .\biggi-tokenomics-automation --target staging-settings --trigger-index 0 --non-interactive
```

Production deployment, receiver wiring, and activation must follow the
BIGGI_MASTER source-of-truth docs under
`../contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET`.
