# Agent documentation — Library/BiggiSwapLib.sol

**Role:** Swap math/helper library

## Purpose
Shared helpers for minOut/slippage/deadline/path handling in swap modules.

## Declarations
- BiggiSwapLib

## Imports
- No imports.

## Key functions
- `getAmountsOut()`
- `pathNativeToToken()`
- `pathTokenToNative()`
- `quoteMinOut()`

## Safe-edit guidance for agents
- Treat libraries as shared behavior. Small changes can affect many contracts simultaneously.
- Update every dependent contract/test when changing constants or math semantics.

## Known risks / review notes
- No file-specific issue flagged in this pass beyond shared-library blast radius.