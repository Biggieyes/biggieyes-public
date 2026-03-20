# BiggiChapterController

## Purpose
Chapter lifecycle controller.

## Role
- stores chapter caps and addresses
- confirms when public collection is unlocked
- exposes chapter VRF price provider

## Unlock invariant
Public mint is unlocked only when:
- `saleMinted == saleCap`
- `marketingMinted == marketingCap`
- `totalMinted == totalCap`

## Logic change level
MINOR LOGIC CHANGE

This formalizes the chapter unlock rule required by the target architecture.
