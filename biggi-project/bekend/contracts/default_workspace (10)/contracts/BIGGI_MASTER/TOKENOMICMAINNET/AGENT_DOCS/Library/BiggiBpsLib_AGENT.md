# Agent documentation — TOKENOMIC_LIBRARY/BiggiBpsLib.sol

**Role:** Basis points helper library

## Purpose
Pure helpers and constants for BPS-based calculations.

## Declarations
- BiggiBpsLib

## Imports
- No imports.

## Key functions
- `part()`

## Safe-edit guidance for agents
- Treat libraries as shared behavior. Small changes can affect many contracts simultaneously.
- Update every dependent contract/test when changing constants or math semantics.

## Known risks / review notes
- No file-specific issue flagged in this pass beyond shared-library blast radius.