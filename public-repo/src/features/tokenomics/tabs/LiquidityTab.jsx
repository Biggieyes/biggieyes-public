import * as React from "react";
import LiquidityVaultChart from "../../../components/TOKEN/LiquidityVaultChart.jsx";
import { ADDR } from "@/shared/utils/contract";
import Card from "../components/Card.jsx";
import Line from "../components/Line.jsx";
import { fmtVal, fmtLp, shortAddr } from "../utils/format.js";
import styles from "../styles/BiggiToken.module.css";

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
  lmUpkeepNeeded,
  lmAddress,
  lmVaultAddress,
  warnings,
}) {
  return (
    <Card
      title="Reserve / LM / Vault"
      subtitle="30% distributor share + BIGGI mints"
      tone="v"
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

        <div className={styles.ecoTables}>
          <div className={styles.ecoTable}>
            <div className={styles.ecoTableHeader}>Liquidity status</div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>Chain</span>
              <span className={styles.ecoTableValue}>
                {chainStatus.chainId ? `chainId ${chainStatus.chainId}` : "--"}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>Account</span>
              <span className={`${styles.ecoTableValue} ${styles.ecoAddrMono}`}>
                {chainStatus.account ? shortAddr(chainStatus.account) : "--"}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>Role</span>
              <span className={styles.ecoTableValue}>{userRole}</span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>LP in vault</span>
              <span className={styles.ecoTableValue}>
                {fmtLp(lmView?.lpBalance ?? reserve?.lpBalanceInVault)}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>Native balance (Reserve)</span>
              <span className={styles.ecoTableValue}>
                {fmtVal(lmView?.reserveMatic ?? reserve?.maticBalance, "POL")}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>BIGGI balance (Reserve)</span>
              <span className={styles.ecoTableValue}>
                {fmtVal(lmView?.reserveBiggi ?? reserve?.biggiBalance, "BIGGI")}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>DEX refill BIGGI</span>
              <span className={styles.ecoTableValue}>
                {fmtVal(lmView?.dexRefillBiggi ?? reserve?.dexRefillBiggi, "BIGGI")}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>BIGGI across R / LM / LV</span>
              <span className={styles.ecoTableValue}>
                {fmtVal(lmChainBalances?.reserve, "R")} | {fmtVal(lmChainBalances?.liquidityManager, "LM")} | {fmtVal(lmChainBalances?.liquidityVault, "LV")}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>Waiting BIGGI -&gt; LM</span>
              <span className={styles.ecoTableValue}>
                {fmtVal(reserve?.waitingBiggi, "BIGGI")}
              </span>
            </div>
          </div>

          <div className={styles.ecoTable}>
            <div className={styles.ecoTableHeader}>LM configuration</div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>LM token %</span>
              <span className={styles.ecoTableValue}>
                {lmTokenPct != null ? `${lmTokenPct}%` : "--"}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>LM slippage</span>
              <span className={styles.ecoTableValue}>
                {lmSlippageBps != null ? `${lmSlippageBps} bps` : "--"}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>LM deadline</span>
              <span className={styles.ecoTableValue}>
                {lmDeadlineSec != null ? `${lmDeadlineSec} s` : "--"}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>Keeper</span>
              <span className={`${styles.ecoTableValue} ${styles.ecoAddrMono}`}>
                {shortAddr(lmKeeperAddress)}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>LM upkeep needed</span>
              <span className={styles.ecoTableValue}>
                {lmUpkeepNeeded == null ? "--" : lmUpkeepNeeded ? "Yes" : "No"}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>Liquidity Manager</span>
              <span className={`${styles.ecoTableValue} ${styles.ecoAddrMono}`}>
                {shortAddr(lmAddress)}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>Reserve contract</span>
              <span className={`${styles.ecoTableValue} ${styles.ecoAddrMono}`}>
                {shortAddr(reserve?.reserveAddress || ADDR.RESERVE)}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>Liquidity Vault</span>
              <span className={`${styles.ecoTableValue} ${styles.ecoAddrMono}`}>
                {shortAddr(lmVaultAddress)}
              </span>
            </div>
            <div className={styles.ecoTableRow}>
              <span className={styles.ecoTableLabel}>Pair whitelisted</span>
              <span className={styles.ecoTableValue}>
                {reserve?.pairWhitelisted ? "Yes" : "No"}
              </span>
            </div>
            {warnings?.length ? (
              <div className={styles.ecoTableRow}>
                <span className={styles.ecoTableLabel}>Warnings</span>
                <span className={styles.ecoTableValue} style={{ color: "#ffb347" }}>
                  {warnings.map((w, i) => (
                    <span key={i} className="mono">- {w}</span>
                  ))}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
