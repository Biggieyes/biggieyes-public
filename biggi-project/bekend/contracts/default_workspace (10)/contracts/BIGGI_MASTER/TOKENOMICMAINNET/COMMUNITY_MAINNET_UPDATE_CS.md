# BIGGI Mainnet Update (community draft)

Date: 2026-03-20

## Co se meni oproti testnetu
1. Mainnet architektura je rozdelena na stabilni core vrstvu a oddelenou tokenomics vrstvu.
2. Tokenomika ma nove bezpecnostni vetve:
   - BiggiSupplyController (automaticke doplnovani kritickych vetvi),
   - BiggiDexReserveGuard (guard proti kritickemu poklesu rezerv na DEX),
   - BiggiSupplyGuardian (manualni nouzova vrstva v omezenych limitech).
3. Treasury flow je vice deterministicky: buyback vystupy jdou definovane do TokenRewards, Reserve a Drip vetve.
4. Likvidita je pripravena na mainnet provoz s jasnou orchestraci a custody vetvi pro LP aktiva.
5. Reader vrstva je rozsiren a sjednocena (MainReader, SystemReader, SupplyControllerReader atd.), aby frontend/backend meli stabilni data.
6. ABI baliky jsou pripraveny oddelene pro CORE a TOKENOMICMAINNET, takze integrace je jednodussi a konzistentni.

## Co to znamena pro komunitu
- Vyssi odolnost pri nestandardnich trzich podminkach.
- Lepsi kontrola nad refill/circuit-breaker scenari.
- Lepsi monitoring a transparentnost stavu systemu.
- Priprava na skalu vice kolekci bez nutnosti menit zakladni architekturu.

## Co jeste zbyva pred ostrym nasazenim
1. Dopsat finalni mainnet adresy (router, pair, keepers, multisig owners).
2. Aktivovat vybranou keeper topologii (bez duplicitnich vetvi).
3. Finalne nastavit a overit VRF produkcni parametry.
4. Udelat finalni fork/mainnet rehearsal a uzavrit release checklist.

## Zaverecna poznamka
Cilem mainnetu je konzistence, predvidatelnost a bezpecna skala. Proto je cast zmen orientovana na guard rails a operational controls, ne pouze na nove funkce.

## Public material
- Kratka verze pro social/community: `COMMUNITY_MAINNET_PUBLIC_SHORT_CS.md`
- Delsi FAQ verze (community + investori): `COMMUNITY_MAINNET_FAQ_LONG_CS.md`
