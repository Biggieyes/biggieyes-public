# Agent documentation — Multicall2.sol

**Role:** Generic batch-read utility

## Purpose
Read-only batched staticcall helper for frontend/agents.

## Top-level declarations
- Contracts/libraries: Multicall2
- Interfaces in file: None

## Imports / external dependencies
- No imports.

## Key public state to inspect
- No obvious public state declarations found by static scan.

## Key functions
- `aggregate()`

## Integration points
- Read-only surface for UI/agents; changing return shapes will break dashboards and scripts first.

## Safe-edit guidance for agents
- Preserve storage layout unless a migration is explicitly planned.
- Do not silently change percentages, caps, cooldowns, or authority checks.
- If changing any external call target or event shape, update readers/setup/orchestrator docs at the same time.
- Prefer additive changes with explicit events over implicit behavior changes.

## Known risks / review notes
- No file-specific issue flagged in this pass beyond standard tokenomics/change-management caution.

## Agent checklist before modifying
- Confirm who owns/controls this contract in deployment scripts.
- Confirm downstream readers/proxies/orchestrators that reference this contract.
- Re-check cap/accounting invariants after any edit.
- Add/update tests for changed paths (happy path + revert path).