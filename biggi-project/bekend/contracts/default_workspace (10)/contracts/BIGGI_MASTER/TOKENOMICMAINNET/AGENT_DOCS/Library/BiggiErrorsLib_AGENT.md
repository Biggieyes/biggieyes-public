# Agent documentation — TOKENOMIC_LIBRARY/BiggiErrorsLib.sol

**Role:** Shared custom errors library

## Purpose
Centralized reusable custom errors for tokenomics contracts.

## Declarations
- BiggiErrorsLib

## Imports
- No imports.

## Key functions

## Safe-edit guidance for agents
- Treat libraries as shared behavior. Small changes can affect many contracts simultaneously.
- Update every dependent contract/test when changing constants or math semantics.

## Known risks / review notes
- No file-specific issue flagged in this pass beyond shared-library blast radius.