// src/services/main2Service.js

import { fromWei, getReadOnlyMain2, getMain2 } from "../utils/contract";
// POZN: pokud ještě nemáš getReadOnlyMain2/getMain2 v contract.js,
// můžeš je tam jednoduše přidat jako factory na BiggiEyesMain2.

/**
 * READ-ONLY ČÁST
 */

export async function getMaxBatch() {
  const c = await getReadOnlyMain2();
  const v = await c.MAX_BATCH();
  return Number(v);
}

export async function getMaxSupply() {
  const c = await getReadOnlyMain2();
  const v = await c.MAX_SUPPLY();
  return Number(v);
}

export async function getBiggiTokenAddress() {
  const c = await getReadOnlyMain2();
  return await c.BIGGI();
}

export async function getBiggiMinted() {
  const c = await getReadOnlyMain2();
  const v = await c.biggiMinted();
  return Number(v);
}

export async function getBiggiPerEthRaw() {
  const c = await getReadOnlyMain2();
  return await c.biggiPerEth(); // BigNumber
}

export async function getBiggiPerEthHuman() {
  const raw = await getBiggiPerEthRaw();
  // 1 ETH -> X BIGGI, tady jen převedeme na string (počítat ratio může FE)
  return fromWei(raw);
}

export async function getBlockOf(tokenId) {
  const c = await getReadOnlyMain2();
  const blk = await c.blockOf(tokenId);
  return Number(blk);
}

export async function getBackgroundMintCount(bgIdx) {
  const c = await getReadOnlyMain2();
  const v = await c.getBackgroundMintCount(bgIdx);
  return Number(v);
}

export async function getBlockMintCount(blockIdx) {
  const c = await getReadOnlyMain2();
  const v = await c.getBlockMintCount(blockIdx);
  return Number(v);
}

export async function getCurrentBlockPriceRaw(blockIdx) {
  const c = await getReadOnlyMain2();
  return await c.getCurrentBlockPrice(blockIdx); // BigNumber
}

export async function getCurrentBlockPriceEth(blockIdx) {
  const raw = await getCurrentBlockPriceRaw(blockIdx);
  return fromWei(raw);
}

/**
 * getMintData(index)
 * V kontraktu vrací 3 uint256 – nechám je genericky pojmenované,
 * ať nic netipujeme, FE si je může pojmenovat podle potřeby.
 */
export async function getMintData(index) {
  const c = await getReadOnlyMain2();
  const res = await c.getMintData(index);
  // res je [u0, u1, u2] nebo objekt s indexy
  const a = res[0];
  const b = res[1];
  const c3 = res[2];

  return {
    a,
    b,
    c: c3,
  };
}

/**
 * nftInfo(index) – kompletní struct
 */
export async function getNftInfo(index) {
  const c = await getReadOnlyMain2();
  const info = await c.nftInfo(index);

  return {
    minted: info.minted ?? info[0],
    background: Number(info.background ?? info[1]),
    blockIdx: Number(info.blockIdx ?? info[2]),
    mainId: info.mainId ?? info[3],
    ticketPrice: info.ticketPrice ?? info[4],
    blockPrice: info.blockPrice ?? info[5],
    finalPrice: info.finalPrice ?? info[6],
    raw: info,
  };
}

/**
 * Základní adresy a stav
 */

export async function getPriceProvider() {
  const c = await getReadOnlyMain2();
  return await c.priceProvider();
}

export async function getDistributorAddress() {
  const c = await getReadOnlyMain2();
  return await c.distributor();
}

export async function getReserveAddress() {
  const c = await getReadOnlyMain2();
  return await c.reserveAddress();
}

export async function isPaused() {
  const c = await getReadOnlyMain2();
  return await c.paused();
}

export async function getName() {
  const c = await getReadOnlyMain2();
  return await c.name();
}

export async function getSymbol() {
  const c = await getReadOnlyMain2();
  return await c.symbol();
}

/**
 * ERC-721 základ
 */

export async function getBalanceOf(owner) {
  const c = await getReadOnlyMain2();
  const v = await c.balanceOf(owner);
  return v.toString();
}

export async function getOwnerOf(tokenId) {
  const c = await getReadOnlyMain2();
  return await c.ownerOf(tokenId);
}

export async function getTokenURI(tokenId) {
  const c = await getReadOnlyMain2();
  return await c.tokenURI(tokenId);
}

/**
 * WRITE FUNKCE (přes signer)
 * Neměním žádnou logiku – jen zabaluju volání.
 */

export async function mintPublic(idx, valueWei) {
  const c = await getMain2();
  // valueWei musíš spočítat/nechat spočítat mimo – service nic neodhaduje.
  const tx = await c.mintPublic(idx, { value: valueWei });
  return tx.wait();
}

export async function mintPublicWithBiggi(idx) {
  const c = await getMain2();
  // Pozor: předtím musí mít kontrakt schválený allowance na BIGGI tokenu.
  const tx = await c.mintPublicWithBiggi(idx);
  return tx.wait();
}

/**
 * Optionální helper: doporučená cena pro idx (pokud getMintData vrací finální cenu v c)
 */
export async function getSuggestedMintPriceWei(idx) {
  const data = await getMintData(idx);
  // typicky to bude data.c = finalPrice, ale FE si to může přepsat.
  return data.c;
}

export async function getSuggestedMintPriceEth(idx) {
  const wei = await getSuggestedMintPriceWei(idx);
  return fromWei(wei);
}

/**
 * Default export – můžeš importovat jako objekt
 */

const main2Service = {
  getMaxBatch,
  getMaxSupply,
  getBiggiTokenAddress,
  getBiggiMinted,
  getBiggiPerEthRaw,
  getBiggiPerEthHuman,
  getBlockOf,
  getBackgroundMintCount,
  getBlockMintCount,
  getCurrentBlockPriceRaw,
  getCurrentBlockPriceEth,
  getMintData,
  getNftInfo,
  getPriceProvider,
  getDistributorAddress,
  getReserveAddress,
  isPaused,
  getName,
  getSymbol,
  getBalanceOf,
  getOwnerOf,
  getTokenURI,
  mintPublic,
  mintPublicWithBiggi,
  getSuggestedMintPriceWei,
  getSuggestedMintPriceEth,
};

export default main2Service;
