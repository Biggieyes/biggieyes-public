import { Contract } from "ethers";
import { getProvider } from "../../../web3/provider";
import { getLiquidityContracts } from "../../../web3/contracts/liquidity.contracts";
import { getTokenDexAddresses } from "../../../config/addresses";
import {
  BiggiLiquidityHelperReader as ABI_BiggiLiquidityHelperReader,
  BiggiReserveTreasuryReader as ABI_BiggiReserveTreasuryReader,
} from "@/config/abi/index.js";

const DEBUG = (() => {
  try {
    return (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_DEBUG_LIQUIDITY === "true"
    );
  } catch {
    return false;
  }
})();

async function _callOptional(method, fallback = null) {
  if (typeof method !== "function") return fallback;
  try {
    return await method();
  } catch (error) {
    console.warn("Liquidity snapshot helper call failed", method?.name, error);
    return fallback;
  }
}

async function _readTotalLpLocked({ vault, chainId }) {
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
    if (typeof vault.lpBalanceOf !== "function") return null;
    return await vault.lpBalanceOf(pairAddress);
  } catch (error) {
    console.warn("Liquidity snapshot helper call failed", "lpBalanceOf", error);
    return null;
  }
}

export async function fetchLiquiditySnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  const { reserve, manager, vault, helper, reserveTreasuryReader } =
    getLiquidityContracts(chainId, signerOrProvider);

  const tokenDex = getTokenDexAddresses(chainId);

  let routerAddress = null;
  let factoryAddress = null;
  let vaultAddress = null;
  let reservePol = null;
  let reserveBiggi = null;
  let waitingBiggi = null;
  let dexRefillBiggi = null;
  let totalMaticReceived = null;
  let treasuryPol = null;
  let treasuryBiggi = null;

  try {
    if (helper?.address) {
      const reader = new Contract(
        helper.address,
        ABI_BiggiLiquidityHelperReader,
        signerOrProvider,
      );
      const info = await reader.routerInfo();
      routerAddress = info?.routerAddr ?? info?.[0] ?? null;
      factoryAddress = info?.factory ?? info?.[1] ?? null;
    }
  } catch (err) {
    console.warn("[LiquiditySnapshot] helper.routerInfo failed", err);
  }

  try {
    if (reserveTreasuryReader?.address) {
      const rtReader = new Contract(
        reserveTreasuryReader.address,
        ABI_BiggiReserveTreasuryReader,
        signerOrProvider,
      );
      const [resSnap, treSnap] = await Promise.all([
        rtReader.reserveSnapshot(),
        rtReader.treasurySnapshot(),
      ]);
      reservePol = resSnap?.reservePol ?? resSnap?.[0];
      reserveBiggi = resSnap?.reserveBiggi ?? resSnap?.[1];
      waitingBiggi = resSnap?.waiting ?? resSnap?.[2];
      dexRefillBiggi = resSnap?.dexRefill ?? resSnap?.[3];
      totalMaticReceived = resSnap?.totalReceivedPol ?? resSnap?.[4];
      treasuryPol = treSnap?.treasuryPol ?? treSnap?.[0];
      treasuryBiggi = treSnap?.treasuryBiggi ?? treSnap?.[1];
    }
  } catch (err) {
    console.warn(
      "[LiquiditySnapshot] reserveTreasuryReader snapshot failed",
      err,
    );
  }

  if (!routerAddress || !factoryAddress || !vaultAddress) {
    try {
      [routerAddress, factoryAddress, vaultAddress] = await Promise.all([
        routerAddress || _callOptional(manager.router),
        factoryAddress || _callOptional(manager.factory),
        _callOptional(manager.liquidityVault),
      ]);
    } catch (err) {
      console.warn(
        "[LiquiditySnapshot] Chyba p‘ti naŽ›ÆðtÆónÆð adres/metod:",
        err,
      );
    }
  }

  let vaultLiquidityManager = null,
    totalLpLocked = null;
  try {
    [vaultLiquidityManager, totalLpLocked] = await Promise.all([
      _callOptional(vault.liquidityManager),
      _readTotalLpLocked({ vault, chainId }),
    ]);
    if (DEBUG) {
      console.log(
        "[LiquiditySnapshot] vault.liquidityManager:",
        vaultLiquidityManager,
      );
      console.log("[LiquiditySnapshot] vault.totalLpLocked:", totalLpLocked);
    }
  } catch (err) {
    console.warn("[LiquiditySnapshot] Chyba p‘ti naŽ›ÆðtÆónÆð vault hodnot:", err);
  }

  const pairAddress = tokenDex?.pairAddress || null;
  let pairWhitelisted = null;
  let vaultLpBalance = totalLpLocked;
  try {
    if (helper?.address && pairAddress) {
      const reader = new Contract(
        helper.address,
        ABI_BiggiLiquidityHelperReader,
        signerOrProvider,
      );
      const v = await reader.vaultInfo(pairAddress);
      pairWhitelisted = v?.pairWhitelisted ?? v?.[0] ?? null;
      vaultLpBalance = v?.vaultLpBalance ?? v?.[1] ?? vaultLpBalance;
    }
  } catch (err) {
    console.warn("[LiquiditySnapshot] helper.vaultInfo failed", err);
  }

  return {
    ts: Date.now(),
    reserve: {
      address: reserve.address,
      maticBalance:
        reservePol != null ? reservePol : await _callOptional(reserve.maticBalance),
      biggiBalance:
        reserveBiggi != null
          ? reserveBiggi
          : await _callOptional(reserve.biggiBalance),
      totalMaticReceived:
        totalMaticReceived != null
          ? totalMaticReceived
          : await _callOptional(reserve.totalMaticReceived),
      waitingBiggi:
        waitingBiggi != null
          ? waitingBiggi
          : await _callOptional(reserve.waitingBiggi),
      dexRefillBiggi:
        dexRefillBiggi != null
          ? dexRefillBiggi
          : await _callOptional(reserve.dexRefillBiggi),
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
      totalLpLocked: vaultLpBalance ?? totalLpLocked,
      pairWhitelisted,
    },
    treasury: {
      address: tokenDex?.treasury || null,
      nativeBalance: treasuryPol ?? null,
      tokenBalance: treasuryBiggi ?? null,
    },
  };
}
