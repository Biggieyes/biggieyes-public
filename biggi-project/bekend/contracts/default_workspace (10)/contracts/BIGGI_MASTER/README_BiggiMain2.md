# BiggiEyesMain2

## Purpose
Public collection for one chapter.

## Preserved from original logic
- explicit index mint
- metadata storage
- price read from VRF-side provider
- native/BIGGI payment routing
- distributor split

## Logic change level
MINOR LOGIC CHANGE

### Changed
- mint is now gated by `BiggiChapterController`
- price provider can be resolved from chapter controller

## Important invariant
Public mint must stay locked until the paired VRF chapter is fully exhausted.
