import * as React from "react";
import DexLiquidityChart from "../../../components/TOKEN/DexLiquidityChart.jsx";
import Card from "../components/Card.jsx";
import Line from "../components/Line.jsx";
import AddressLine from "../components/AddressLine.jsx";
import Button from "../components/Button.jsx";
import { fmtVal } from "../utils/format.js";

export default function TokenDexTab({
  tabBusy,
  onRefresh,
  pumpView,
  liquidity,
  dexHistory,
  tok,
  router,
}) {
  return (
    <Card
      title="Token & DEX"
      subtitle="BIGGI/WETH pair, router and reserves"
      tone="v"
      action={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="v" disabled={tabBusy} onClick={onRefresh}>
            {tabBusy ? "Refreshing..." : "Refresh tab"}
          </Button>
        </div>
      }
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
      <div className="biggi-contract-grid">
        <div className="biggi-contract-box">
          <AddressLine label="Token" address={tok?.address} />
          <AddressLine label="Router" address={router?.routerAddress || tok?.routerAddr} />
          <AddressLine label="Wrapped native" address={router?.wrappedNative || tok?.weth} />
          <AddressLine label="Pair" address={liquidity?.pairAddress || tok?.pair} />
          <AddressLine label="Factory" address={tok?.factoryAddr} />
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
