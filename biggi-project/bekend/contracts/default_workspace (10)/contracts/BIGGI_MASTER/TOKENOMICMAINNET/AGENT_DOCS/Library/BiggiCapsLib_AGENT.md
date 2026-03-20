# Agent documentation — Library/BiggiCapsLib.sol

**Role:** Tokenomics cap constants library

## Purpose
Defines initial supply, branch caps, and guardian mint budgets.

## Declarations
- BiggiCapsLib

## Imports
- No imports.

## Key functions

## Safe-edit guidance for agents
- Treat libraries as shared behavior. Small changes can affect many contracts simultaneously.
- Update every dependent contract/test when changing constants or math semantics.

## Known risks / review notes
- Changes here alter tokenomics globally. Any cap/budget change is a business-logic change and must be announced explicitly.