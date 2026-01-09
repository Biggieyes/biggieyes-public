import * as React from "react";
import LiquidityVaultChart from "../../../components/TOKEN/LiquidityVaultChart.jsx";
import LMReserveTokenDexButton from "../../../components/TOKEN/LMReserveTokenDexButton.jsx";
import { ADDR } from "../../../utils/contract";
import Card from "../components/Card.jsx";
import Line from "../components/Line.jsx";
import { fmtVal, fmtLp, shortAddr } from "../utils/format.js";

export default function LiquidityTab({
  tabBusy,
  onRefresh,
  liquidityHistory,
  lmView,
  reserve,
  chainStatus,
  userRole,
  lmChainBalances,
  lmTokenPct,
  lmSlippageBps,
  lmDeadlineSec,
  lmKeeperAddress,
  lmAddress,
  lmVaultAddress,
  warnings,
}) {
  return (
    <Card
      title="Reserve / LM / Vault"
      subtitle="30% distributor share + BIGGI mints"
      tone="v"
      action={
        <LMReserveTokenDexButton disabled={tabBusy} onClick={onRefresh} />
      }
    >
      <div className="liquidity-vault-layout liquidity-vault-layout--chart-first">
        <div className="liquidity-vault-chartwrap">
          <div className="liquidity-vault-charthead">
            <div>
              <div className="muted">Liquidity Vault</div>
              <div className="liquidity-vault-charttitle">Liquidity over time</div>
            </div>
            <div className="liquidity-vault-pill">
              LP {fmtLp(lmView?.lpBalance ?? reserve?.lpBalanceInVault)} | Native {fmtVal(lmView?.reserveMatic ?? reserve?.maticBalance, "POL")}
            </div>
          </div>
          <LiquidityVaultChart data={liquidityHistory} />
        </div>

        <div className="liquidity-vault-table">
          <div className="lv-row">
            <span>Chain</span>
            <span className="mono lv-value">{chainStatus.chainId ? `chainId ${chainStatus.chainId}` : "--"}</span>
          </div>
          <div className="lv-row">
            <span>Account</span>
            <span className="mono lv-value lv-value--addr">
              {chainStatus.account ? shortAddr(chainStatus.account) : "--"}
            </span>
          </div>
          <div className="lv-row">
            <span>Role</span>
            <span className="mono lv-value">{userRole}</span>
          </div>
          <div className="lv-row">
            <span>LP in vault</span>
            <span className="mono lv-value">
              {fmtLp(lmView?.lpBalance ?? reserve?.lpBalanceInVault)}
            </span>
          </div>
          <div className="lv-row">
            <span>Native balance (Reserve)</span>
            <span className="mono lv-value">
              {fmtVal(lmView?.reserveMatic ?? reserve?.maticBalance, "POL")}
            </span>
          </div>
          <div className="lv-row">
            <span>BIGGI balance (Reserve)</span>
            <span className="mono lv-value">
              {fmtVal(lmView?.reserveBiggi ?? reserve?.biggiBalance, "BIGGI")}
            </span>
          </div>
          <div className="lv-row">
            <span>DEX refill BIGGI</span>
            <span className="mono lv-value">
              {fmtVal(lmView?.dexRefillBiggi ?? reserve?.dexRefillBiggi, "BIGGI")}
            </span>
          </div>
          <div className="lv-row">
            <span>BIGGI across Reserve / LM / Vault</span>
            <span className="mono lv-value">
              {fmtVal(lmChainBalances?.reserve, "R")} | {fmtVal(lmChainBalances?.liquidityManager, "LM")} | {fmtVal(lmChainBalances?.liquidityVault, "LV")}
            </span>
          </div>
          <div className="lv-row">
            <span>Waiting BIGGI -&gt; LM</span>
            <span className="mono lv-value">
              {fmtVal(reserve?.waitingBiggi, "BIGGI")}
            </span>
          </div>
          <div className="lv-row">
            <span>LM token %</span>
            <span className="mono lv-value">
              {lmTokenPct != null ? `${lmTokenPct}%` : "--"}
            </span>
          </div>
          <div className="lv-row">
            <span>LM slippage</span>
            <span className="mono lv-value">
              {lmSlippageBps != null ? `${lmSlippageBps} bps` : "--"}
            </span>
          </div>
          <div className="lv-row">
            <span>LM deadline</span>
            <span className="mono lv-value">
              {lmDeadlineSec != null ? `${lmDeadlineSec} s` : "--"}
            </span>
          </div>
          <div className="lv-row">
            <span>Keeper</span>
            <span className="mono lv-value lv-value--addr">
              {shortAddr(lmKeeperAddress)}
            </span>
          </div>
          <div className="lv-row">
            <span>Liquidity Manager</span>
            <span className="mono lv-value lv-value--addr">
              {shortAddr(lmAddress)}
            </span>
          </div>
          <div className="lv-row">
            <span>Reserve contract</span>
            <span className="mono lv-value lv-value--addr">
              {shortAddr(reserve?.reserveAddress || ADDR.RESERVE)}
            </span>
          </div>
          <div className="lv-row">
            <span>Liquidity Vault</span>
            <span className="mono lv-value lv-value--addr">
              {shortAddr(lmVaultAddress)}
            </span>
          </div>
          <div className="lv-row">
            <span>Pair whitelisted</span>
            <span className="lv-value">
              {reserve?.pairWhitelisted ? "Yes" : "No"}
            </span>
          </div>
          {warnings?.length ? (
            <div className="lv-row" style={{ color: "#ffb347", flexDirection: "column", alignItems: "flex-start" }}>
              <span>Warnings</span>
              {warnings.map((w, i) => (
                <span key={i} className="mono">- {w}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
