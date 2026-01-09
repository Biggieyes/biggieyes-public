import LiquidityTab from "../tabs/LiquidityTab.jsx";
import TokenDexTab from "../tabs/TokenDexTab.jsx";

export default function TokenomicsPanel({
  segment = "reserve",
  liquidityProps,
  dexProps,
}) {
  if (segment === "dex") {
    return <TokenDexTab {...dexProps} />;
  }

  return <LiquidityTab {...liquidityProps} />;
}
