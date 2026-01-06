// Zde definujte adresy kontraktů pro všechny sítě. Upravte podle skutečných adres!
const ADDR = {
  // Hlavní kontrakty
  RESERVE: "0xbF694e346D69acCEb578eA7C52642C521178e385",
  LM: "0x57F2Dc49f2fd1d5B1308e409aFfD9d423c0EA1AE", // LiquidityManager
  LIQUIDITY_VAULT: "0xc51e6D0f94f5F9feC82DD83D18Eb822925C16eD5",
  // Drip
  DRIP_DISTRIBUTOR: "0x2564b32eE85d2DFe3c234f79BBCaA94704e91FAE",
  DRIP_LM: "0xf1A1f9C8fB64b8E14BbB35b6a41E139C7980db52",
  // Tokeny
  BIGGI_TOKEN: "0x45C6cC46dcBf54E97bDf89e9F739F29Ce4ED0dB7",
  BIGGI: "0x45C6cC46dcBf54E97bDf89e9F739F29Ce4ED0dB7", // alias
  // Router, Factory, WETH, Pair
  ROUTER: "0x52141c1c00AdD7dF95031c684186b10b5fDf448b",
  FACTORY: "0x48D4D4BD5336Cc51209603AB4fA11A2dEF0Ba30F",
  WETH: "0x9984a18ee1f243992aF8d6a5E40c0373F88D99Ef",
  PAIR: "0x59133d46598D178be59f2c6E1eFF222FFAf92229",
  // Oracles, Feed
  BIGGI_PRICE_ORACLE: "0xac84a91d9732c4fF74Cab4c40b37a2F0aaEE7088", // není v seznamu, doplňte pokud existuje
  // Treasury, Rewards
  TREASURY: "0xA1C5b749EDb98B5000DCaf30d4244AbB099BCEFb",
  TOKEN_REWARDS: "0xbFAE50A44b1C6559750e1EBCb03B878C1828945D",
  // Buyback
  BUYBACK_AGENT: "0xCF3D72254b913e7a1311Be3Ec11a21Bd298e2728",
  // Další adresy z vašeho seznamu (přidejte podle potřeby do logiky projektu):
  COLLECTION: "0x304C08cdC4511649D97469E0F7A1f71270BC91E6",
  COLLECTION2: "0x1703EA074C72F550ecacb955ECE1aac1c5100Be5",
  m1: "0x304C08cdC4511649D97469E0F7A1f71270BC91E6", // BiggiMain
  m2: "0x1703EA074C72F550ecacb955ECE1aac1c5100Be5", // BiggiMain2
  dripd: "0x2564b32eE85d2DFe3c234f79BBCaA94704e91FAE", // DripDistributor
  dripLm: "0xf1A1f9C8fB64b8E14BbB35b6a41E139C7980db52", // DripLM
  reserve: "0xbF694e346D69acCEb578eA7C52642C521178e385", // BiggiReserve
    BiggiMain: "0x304C08cdC4511649D97469E0F7A1f71270BC91E6",
    BiggiMain2: "0x1703EA074C72F550ecacb955ECE1aac1c5100Be5",
    BiggiMasterTokenomicsConfig: "", // doplnit správnou adresu
    BiggiReserve: "0xbF694e346D69acCEb578eA7C52642C521178e385",
    BiggiRewardsReader: "", // doplnit správnou adresu
    DripDistributor: "0x2564b32eE85d2DFe3c234f79BBCaA94704e91FAE",
    DripLM: "0xf1A1f9C8fB64b8E14BbB35b6a41E139C7980db52",
    LiquidityKeeper: "", // doplnit správnou adresu
  COLLECTION_REWARDS: "0xaD59A214a629daa6c0b91951A7967b233Ae7d8b8",
  COMMUNITY_CENTER: "0x3462BC1561c3209848FC77e47cc1fF28d4a61b80",
  DISTRIBUTOR: "0xF29D65834e344bd229311686FccA4AAf451612e5",
  DRIP_KEEPER_PROXY: "0xc9C97929DA142DcA433C9A56A790291Aa4B90E6E",
  KEEPER_PROXY: "0x60D0e1791299E1c5AfDc76106380EA08B106B6CF",
  LIQUIDITY_AUTOMATION: "0x47CaDB979De8Beb8136bc2Be3Be7898F83941566",
  LIQUIDITY_SETUP: "0x2B306ac455a66A8630Fdd46416F5DA02dE0Ce05c",
  NFT_REWARDS: "0x5952FB309cbC8919a554702A1Fb937F2e8943F39",
  POLICY: "0xad677D4A01efBc143203412Ed96715e68141dC2f",
  TOKENOMIK_READER: "0xC044eBBc9E1303f1C12a5C47e1137C3EFC57F92a",
  UPKEEP_PROXY: "0x3DEFF461B1ef4Df6df416017a3DA43b7E4f08ca8",

  // Poznámka: PRIVATE_KEY zde neukládejte, patří do .env!
  // PRIVATE_KEY: "0xc823138b3db8f7e3953b96ff3bdda4f39217b624fbe189b25067f15a87b6ea0d",


  // Další adresy mimo hlavní logiku (přidejte podle potřeby):
  COMPUTE: "0x1Be0b75859747ABF7452b82359bFe68D77faD2F0",
  BIGGIBUYBACKDRIPSETUP: "0x0988fc6CAD39463938caB1Ea62aC2719aA759884",
};

const DEFAULT_CHAIN_ID = 80002;

function _baseAddresses() {
  return {
    reserve: ADDR.RESERVE,
    liquidityManager: ADDR.LM,
    liquidityVault: ADDR.LIQUIDITY_VAULT,
  };
}

const CHAIN_ADDRESSES = {
  80002: _baseAddresses(),
  137: _baseAddresses(),
  80001: _baseAddresses(),
};

function _dripAddresses() {
  return {
    dripDistributor: ADDR.DRIP_DISTRIBUTOR,
    dripLM: ADDR.DRIP_LM,
    biggiToken: ADDR.BIGGI_TOKEN || ADDR.BIGGI,
    router: ADDR.ROUTER,
    reserve: ADDR.RESERVE,
    treasury: ADDR.TREASURY,
  };
}

const DRIP_CHAIN_ADDRESSES = {
  80002: _dripAddresses(),
  137: _dripAddresses(),
  80001: _dripAddresses(),
};

function _buybackAddresses() {
  return {
    buybackAgent: ADDR.BUYBACK_AGENT,
    treasury: ADDR.TREASURY,
    biggiToken: ADDR.BIGGI_TOKEN || ADDR.BIGGI,
    router: ADDR.ROUTER,
    reserve: ADDR.RESERVE,
    dripDistributor: ADDR.DRIP_DISTRIBUTOR,
    tokenRewards: ADDR.TOKEN_REWARDS,
  };
}

const BUYBACK_CHAIN_ADDRESSES = {
  80002: _buybackAddresses(),
  137: _buybackAddresses(),
  80001: _buybackAddresses(),
};

export function getLiquidityAddresses(chainId) {
  const resolvedId = Number(chainId) || DEFAULT_CHAIN_ID;
  return CHAIN_ADDRESSES[resolvedId] || CHAIN_ADDRESSES[DEFAULT_CHAIN_ID];
}

export function getDripAddresses(chainId) {
  const resolvedId = Number(chainId) || DEFAULT_CHAIN_ID;
  return DRIP_CHAIN_ADDRESSES[resolvedId] || DRIP_CHAIN_ADDRESSES[DEFAULT_CHAIN_ID];
}

export function getBuybackAddresses(chainId) {
  const resolvedId = Number(chainId) || DEFAULT_CHAIN_ID;
  return BUYBACK_CHAIN_ADDRESSES[resolvedId] || BUYBACK_CHAIN_ADDRESSES[DEFAULT_CHAIN_ID];
}

function _tokenDexAddresses() {
  return {
    biggiToken: ADDR.BIGGI_TOKEN || ADDR.BIGGI,
    router: ADDR.ROUTER,
    factory: ADDR.FACTORY,
    weth: ADDR.WETH,
    pairAddress: ADDR.PAIR,
    lpPriceFeed: ADDR.BIGGI_PRICE_ORACLE,
    reserve: ADDR.RESERVE,
    liquidityVault: ADDR.LIQUIDITY_VAULT,
    treasury: ADDR.TREASURY,
  };
}

const TOKEN_DEX_CHAIN_ADDRESSES = {
  80002: _tokenDexAddresses(),
  137: _tokenDexAddresses(),
  80001: _tokenDexAddresses(),
};

export function getTokenDexAddresses(chainId) {
  const resolvedId = Number(chainId) || DEFAULT_CHAIN_ID;
  return TOKEN_DEX_CHAIN_ADDRESSES[resolvedId] || TOKEN_DEX_CHAIN_ADDRESSES[DEFAULT_CHAIN_ID];
}

export { CHAIN_ADDRESSES, DEFAULT_CHAIN_ID, DRIP_CHAIN_ADDRESSES, BUYBACK_CHAIN_ADDRESSES, ADDR };
export default {
  CHAIN_ADDRESSES,
  DRIP_CHAIN_ADDRESSES,
  BUYBACK_CHAIN_ADDRESSES,
  TOKEN_DEX_CHAIN_ADDRESSES,
  getLiquidityAddresses,
  getDripAddresses,
  getBuybackAddresses,
  getTokenDexAddresses,
  DEFAULT_CHAIN_ID,
  ADDR,
};
