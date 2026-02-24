import * as React from "react";
import DexLiquidityChart from "../../../components/TOKEN/DexLiquidityChart.jsx";
import Card from "../components/Card.jsx";
import Line from "../components/Line.jsx";
import AddressLine from "../components/AddressLine.jsx";
import { fmtVal } from "../utils/format.js";
import styles from "../styles/BiggiToken.module.css";

function TokenDexTab({
  tabBusy,
  onRefresh,
  pumpView,
  liquidity,
  dexHistory,
  tok,
  router,
  tokenDexSnapshot,
}) {
  return (
    <Card
      title="Token & DEX"
      subtitle="BIGGI/WETH pair, router and reserves"
      tone="v"
    >
      <div className="dex-liquidity-layout">
        <div className="dex-chartwrap">
          <div className="dex-charthead">
            <div>
              <div className="muted">DEX liquidity</div>
              <div className="dex-charttitle">Reserves & price</div>
            </div>
            <div className="dex-pill">
              {fmtVal(pumpView?.pair?.nativeReserve ?? liquidity?.reserveNative, "POL", 4)} -
              {" "}
              {fmtVal(pumpView?.pair?.biggiReserve ?? liquidity?.reserveBiggi, "BIGGI", 0)} -
              {" "}
              {fmtVal(liquidity?.biggiPerNative)}
            </div>
          </div>
          <DexLiquidityChart data={dexHistory} />
        </div>
      </div>
      <div className={styles.ecoTable}>
        <div className={styles.ecoTableHeader}>DEX metrics</div>
        <div className={styles.ecoTableRow}>
          <span className={styles.ecoTableLabel}>Pair reserves (native)</span>
          <span className={styles.ecoTableValue}>
            {fmtVal(pumpView?.pair?.nativeReserve ?? liquidity?.reserveNative, "POL")}
          </span>
        </div>
        <div className={styles.ecoTableRow}>
          <span className={styles.ecoTableLabel}>Pair reserves (BIGGI)</span>
          <span className={styles.ecoTableValue}>
            {fmtVal(pumpView?.pair?.biggiReserve ?? liquidity?.reserveBiggi, "BIGGI")}
          </span>
        </div>
        <div className={styles.ecoTableRow}>
          <span className={styles.ecoTableLabel}>BIGGI per 1 POL</span>
          <span className={styles.ecoTableValue}>{fmtVal(liquidity?.biggiPerNative)}</span>
        </div>
        <div className={styles.ecoTableRow}>
          <span className={styles.ecoTableLabel}>POL per 1 BIGGI</span>
          <span className={styles.ecoTableValue}>{fmtVal(liquidity?.nativePerBiggi)}</span>
        </div>
        <div className={styles.ecoTableRow}>
          <span className={styles.ecoTableLabel}>LP total supply</span>
          <span className={styles.ecoTableValue}>
            {fmtVal(pumpView?.pair?.lpTotalSupply ?? liquidity?.lpTotalSupply, "LP")}
          </span>
        </div>
        <div className={styles.ecoTableRow}>
          <span className={styles.ecoTableLabel}>Contract POL</span>
          <span className={styles.ecoTableValue}>
            {fmtVal(liquidity?.contractEthBalance, "POL")}
          </span>
        </div>
      </div>
      <div className="biggi-contract-grid">
        <div className="biggi-contract-box">
          <AddressLine label="Token" address={tok?.address ?? tokenDexSnapshot?.token?.address} />
          <AddressLine
            label="Router"
            address={
              router?.address ??
              router?.routerAddress ??
              tokenDexSnapshot?.dex?.router?.address ??
              tokenDexSnapshot?.dex?.router ??
              tok?.routerAddr
            }
          />
          <AddressLine
            label="Wrapped native"
            address={tokenDexSnapshot?.dex?.weth ?? router?.wrappedNative ?? tok?.weth}
          />
          <AddressLine
            label="Pair"
            address={
              liquidity?.pairAddress ??
              tokenDexSnapshot?.dex?.pair?.address ??
              tokenDexSnapshot?.dex?.pairAddress ??
              tok?.pair
            }
          />
          <AddressLine
            label="Factory"
            address={
              router?.factory ??
              tokenDexSnapshot?.dex?.router?.factory ??
              tok?.factoryAddr
            }
          />
        </div>
        <div className="biggi-contract-box">
          <Line
            label="Pair reserves (native)"
            tone="native"
            value={fmtVal(pumpView?.pair?.nativeReserve ?? liquidity?.reserveNative, "POL")}
          />
          <Line
            label="Pair reserves (BIGGI)"
            tone="token"
            value={fmtVal(pumpView?.pair?.biggiReserve ?? liquidity?.reserveBiggi, "BIGGI")}
          />
          <Line label="BIGGI per 1 POL" value={fmtVal(liquidity?.biggiPerNative)} />
          <Line label="POL per 1 BIGGI" value={fmtVal(liquidity?.nativePerBiggi)} />
          <Line label="LP total supply" value={fmtVal(pumpView?.pair?.lpTotalSupply ?? liquidity?.lpTotalSupply, "LP")} />
          <Line label="Contract POL" tone="native" value={fmtVal(liquidity?.contractEthBalance, "POL")} />
        </div>
      </div>
    </Card>
  );
}

export default React.memo(TokenDexTab);
