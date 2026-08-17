import {
  fromWei,
  getChapterMain2,
  getReadOnlyChapterMain2,
} from "@/shared/utils/contract";

const normalizeChapterId = (chapterId) => {
  const normalized = Number(chapterId);
  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    throw new Error("A valid CORE chapterId is required.");
  }
  return normalized;
};

const getReadContract = (chapterId = 1) =>
  getReadOnlyChapterMain2(normalizeChapterId(chapterId));

const getWriteContract = (chapterId) =>
  getChapterMain2(normalizeChapterId(chapterId));

export async function getMaxBatch(chapterId = 1) {
  return Number(await getReadContract(chapterId).MAX_BATCH());
}

export async function getMaxSupply(chapterId = 1) {
  return Number(await getReadContract(chapterId).MAX_SUPPLY());
}

export async function getBiggiTokenAddress(chapterId = 1) {
  return getReadContract(chapterId).BIGGI();
}

export async function getBiggiMinted(chapterId = 1) {
  return Number(await getReadContract(chapterId).biggiMinted());
}

export async function getBiggiPerEthRaw(chapterId = 1) {
  return getReadContract(chapterId).biggiPerEth();
}

export async function getBiggiPerEthHuman(chapterId = 1) {
  return fromWei(await getBiggiPerEthRaw(chapterId));
}

export async function getBlockOf(chapterId, tokenId) {
  return Number(await getReadContract(chapterId).blockOf(tokenId));
}

export async function getBackgroundMintCount(chapterId, backgroundIndex) {
  return Number(
    await getReadContract(chapterId).getBackgroundMintCount(backgroundIndex),
  );
}

export async function getBlockMintCount(chapterId, blockIndex) {
  return Number(await getReadContract(chapterId).getBlockMintCount(blockIndex));
}

export async function getCurrentBlockPriceRaw(chapterId, blockIndex) {
  return getReadContract(chapterId).getCurrentBlockPrice(blockIndex);
}

export async function getCurrentBlockPriceEth(chapterId, blockIndex) {
  return fromWei(await getCurrentBlockPriceRaw(chapterId, blockIndex));
}

export async function getMintData(chapterId, index) {
  const result = await getReadContract(chapterId).getMintData(index);
  return {
    ticketPrice: result[0],
    blockPrice: result[1],
    finalPrice: result[2],
  };
}

export async function getNftInfo(chapterId, index) {
  const info = await getReadContract(chapterId).nftInfo(index);
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

export async function getPriceProvider(chapterId = 1) {
  return getReadContract(chapterId).priceProvider();
}

export async function getDistributorAddress(chapterId = 1) {
  return getReadContract(chapterId).distributor();
}

export async function getReserveAddress(chapterId = 1) {
  return getReadContract(chapterId).reserveAddress();
}

export async function isPaused(chapterId = 1) {
  return getReadContract(chapterId).paused();
}

export async function getName(chapterId = 1) {
  return getReadContract(chapterId).name();
}

export async function getSymbol(chapterId = 1) {
  return getReadContract(chapterId).symbol();
}

export async function getBalanceOf(chapterId, owner) {
  return (await getReadContract(chapterId).balanceOf(owner)).toString();
}

export async function getOwnerOf(chapterId, tokenId) {
  return getReadContract(chapterId).ownerOf(tokenId);
}

export async function getTokenURI(chapterId, tokenId) {
  return getReadContract(chapterId).tokenURI(tokenId);
}

export async function mintPublic(chapterId, index, valueWei) {
  const contract = await getWriteContract(chapterId);
  const transaction = await contract.mintPublic(index, { value: valueWei });
  return transaction.wait();
}

export async function mintPublicWithBiggi(chapterId, index) {
  const contract = await getWriteContract(chapterId);
  const transaction = await contract.mintPublicWithBiggi(index);
  return transaction.wait();
}

export async function getSuggestedMintPriceWei(chapterId, index) {
  return (await getMintData(chapterId, index)).finalPrice;
}

export async function getSuggestedMintPriceEth(chapterId, index) {
  return fromWei(await getSuggestedMintPriceWei(chapterId, index));
}

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
