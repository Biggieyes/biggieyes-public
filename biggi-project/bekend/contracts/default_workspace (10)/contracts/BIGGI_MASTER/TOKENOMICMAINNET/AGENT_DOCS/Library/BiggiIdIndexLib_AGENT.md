# Agent documentation — Library/BiggiIdIndexLib.sol

**Role:** ID/index translation library

## Purpose
Shared token/NFT id-index conversion helpers used by readers.

## Declarations
- BiggiIdIndexLib

## Imports
- No imports.

## Key functions
- `isTicket()`
- `isMainNft()`
- `isCharacterNft()`
- `isRewardNft()`
- `nftIndexFromTokenId()`
- `tokenIdFromNftIndex()`
- `isValidMintIndex()`
- `randomToMintIndex()`
- `getTokenType()`
- `isUnset()`
- `findUnsetIndices()`
- `hasUnsetIndices()`
- `findDuplicateMainIds()`
- `isAllMainIdsUnique()`

## Safe-edit guidance for agents
- Treat libraries as shared behavior. Small changes can affect many contracts simultaneously.
- Update every dependent contract/test when changing constants or math semantics.

## Known risks / review notes
- No file-specific issue flagged in this pass beyond shared-library blast radius.