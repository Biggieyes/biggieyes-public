import { getLiquidityContracts } from "../../web3/contracts/liquidity.contracts";
import { getProvider } from "../../web3/provider";
import { Contract } from "ethers";
import { getTokenDexAddresses } from "../../config/addresses";

async function _callOptional(method, fallback = null) {
  if (typeof method !== "function") return fallback;
  try {
    return await method();
  } catch (error) {
    console.warn("Liquidity snapshot helper call failed", method?.name, error);
    return fallback;
  }
}

const LP_BALANCE_ABI = [
  "function lpBalanceOf(address lpPair) view returns (uint256)",
];

async function _readTotalLpLocked({ vault, signerOrProvider, chainId }) {
  if (!vault) return null;

  // 1) Newer deployments might expose totalLpLocked()
  try {
    if (typeof vault.totalLpLocked === "function") {
      const res = await vault.totalLpLocked();
      if (res != null) return res;
    }
  } catch (error) {
    const emptyData =
      typeof error?.data === "string" ? error.data === "0x" : false;
    // ignore "missing selector" errors and try fallback below
    if (!emptyData) {
      console.warn(
        "Liquidity snapshot helper call failed",
        "totalLpLocked",
        error,
      );
    }
  }

  // 2) Current LiquidityVault implementation uses lpBalanceOf(pair)
  const tokenDex = getTokenDexAddresses(chainId);
  const pairAddress = tokenDex?.pairAddress || null;
  if (!pairAddress) return null;

  try {
    const vaultCompat = new Contract(
      vault.address,
      LP_BALANCE_ABI,
      signerOrProvider,
    );
    return await vaultCompat.lpBalanceOf(pairAddress);
  } catch (error) {
    console.warn("Liquidity snapshot helper call failed", "lpBalanceOf", error);
    return null;
  }
}

export async function fetchLiquiditySnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  const { reserve, manager, vault } = getLiquidityContracts(
    chainId,
    signerOrProvider,
  );

  let maticBalance,
    biggiBalance,
    totalMaticReceived,
    waitingBiggi,
    dexRefillBiggi,
    routerAddress,
    factoryAddress,
    vaultAddress;
  try {
    [
      maticBalance,
      biggiBalance,
      totalMaticReceived,
      waitingBiggi,
      dexRefillBiggi,
      routerAddress,
      factoryAddress,
      vaultAddress,
    ] = await Promise.all([
      reserve.maticBalance(),
      reserve.biggiBalance(),
      reserve.totalMaticReceived(),
      reserve.waitingBiggi(),
      reserve.dexRefillBiggi(),
      manager.router(),
      manager.factory(),
      manager.liquidityVault(),
    ]);
    console.log("[LiquiditySnapshot] manager.router:", routerAddress);
    console.log("[LiquiditySnapshot] manager.factory:", factoryAddress);
    console.log("[LiquiditySnapshot] manager.liquidityVault:", vaultAddress);
  } catch (err) {
    console.warn("[LiquiditySnapshot] Chyba při načítání adres/metod:", err);
  }

  let vaultLiquidityManager = null,
    totalLpLocked = null;
  try {
    [vaultLiquidityManager, totalLpLocked] = await Promise.all([
      _callOptional(vault.liquidityManager),
      _readTotalLpLocked({ vault, signerOrProvider, chainId }),
    ]);
    console.log(
      "[LiquiditySnapshot] vault.liquidityManager:",
      vaultLiquidityManager,
    );
    console.log("[LiquiditySnapshot] vault.totalLpLocked:", totalLpLocked);
  } catch (err) {
    console.warn("[LiquiditySnapshot] Chyba při načítání vault hodnot:", err);
  }

  return {
    ts: Date.now(),
    reserve: {
      address: reserve.address,
      maticBalance,
      biggiBalance,
      totalMaticReceived,
      waitingBiggi,
      dexRefillBiggi,
      liquidityManager: manager.address,
    },
    manager: {
      address: manager.address,
      routerAddress,
      factoryAddress,
      vaultAddress,
    },
    vault: {
      address: vault.address,
      liquidityManager: vaultLiquidityManager || manager.address,
      totalLpLocked,
    },
  };
}

