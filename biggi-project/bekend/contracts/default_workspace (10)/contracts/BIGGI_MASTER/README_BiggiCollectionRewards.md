# BiggiCollectionRewards

Role: native-coin chapter rewards for VRF collections only.

Preserved:
- orange / block / rainbow reward mechanics
- distributor funding model

Updated:
- added optional `registry` integration
- reward state is now namespaced per VRF collection, so each chapter can have its own orange/block/rainbow race
- legacy no-argument claim functions still use `defaultMain`

Logic change: **MAJOR LOGIC CHANGE**
- reward uniqueness is now per VRF collection instead of one global singleton across all future chapters
- this was necessary for scalable multi-chapter architecture
