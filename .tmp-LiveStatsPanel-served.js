import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/components/layout/LiveStatsPanel.jsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=4098d917"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=4098d917"; const React = ((m) => m?.__esModule ? m : {	...typeof m === "object" && !Array.isArray(m) || typeof m === "function" ? m : {},	default: m})(__vite__cjsImport1_react);
const LiveStats = React.lazy(_c = () => import("/src/components/LiveStats.jsx"));
_c2 = LiveStats;
export default function LiveStatsPanel({
  walletAddress,
  lastMinted,
  biggiMinted,
  maxSupply,
  ticketMinted,
  maxTickets,
  ticketPrice,
  blockMintCounts,
  BACKGROUND_NAMES,
  blockPrices,
  backgroundMintCounts,
  rewardPool,
  myClaimable,
  myNFTs,
  mintVolumeMatic,
  epochStartTs,
  userLastClaimTs,
  fetchChainNowTs,
  isMobile
}) {
  return /* @__PURE__ */ jsxDEV(
    "div",
    {
      className: "widget-center-wrapper",
      id: "live-stats",
      style: isMobile ? { paddingTop: 8 } : void 0,
      children: /* @__PURE__ */ jsxDEV(React.Suspense, { fallback: null, children: /* @__PURE__ */ jsxDEV(
        LiveStats,
        {
          walletAddress,
          lastImage: lastMinted.image,
          lastNftId: lastMinted.tokenId,
          lastBlockName: lastMinted.blockName,
          lastBackgroundName: lastMinted.backgroundName,
          biggiMinted,
          maxSupply,
          ticketMinted,
          maxTickets,
          ticketPrice,
          blockMintCounts,
          blockNames: BACKGROUND_NAMES,
          blockPrices,
          backgroundMintCounts,
          rewardPool,
          myClaimable,
          items: myNFTs,
          mintVolumeMatic,
          sharePercent: 22,
          epochStart: epochStartTs,
          userLastClaimTs,
          weekSeconds: 7 * 24 * 60 * 60,
          fetchChainNowTs,
          compact: isMobile
        },
        void 0,
        false,
        {
          fileName: "C:/dev/BIGGINFTWEB/src/components/layout/LiveStatsPanel.jsx",
          lineNumber: 33,
          columnNumber: 9
        },
        this
      ) }, void 0, false, {
        fileName: "C:/dev/BIGGINFTWEB/src/components/layout/LiveStatsPanel.jsx",
        lineNumber: 32,
        columnNumber: 7
      }, this)
    },
    void 0,
    false,
    {
      fileName: "C:/dev/BIGGINFTWEB/src/components/layout/LiveStatsPanel.jsx",
      lineNumber: 27,
      columnNumber: 5
    },
    this
  );
}
_c3 = LiveStatsPanel;
var _c, _c2, _c3;
$RefreshReg$(_c, "LiveStats$React.lazy");
$RefreshReg$(_c2, "LiveStats");
$RefreshReg$(_c3, "LiveStatsPanel");
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("C:/dev/BIGGINFTWEB/src/components/layout/LiveStatsPanel.jsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/dev/BIGGINFTWEB/src/components/layout/LiveStatsPanel.jsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
function $RefreshReg$(type, id) {
  return RefreshRuntime.register(type, "C:/dev/BIGGINFTWEB/src/components/layout/LiveStatsPanel.jsx " + id);
}
function $RefreshSig$() {
  return RefreshRuntime.createSignatureFunctionForTransform();
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBZ0NRO0FBaENSLFlBQVlBLFdBQVc7QUFFdkIsTUFBTUMsWUFBWUQsTUFBTUUsS0FBSUMsS0FBQ0EsTUFBTSxPQUFPLGNBQWMsQ0FBQztBQUFFQyxNQUFyREg7QUFFTix3QkFBd0JJLGVBQWU7QUFBQSxFQUNyQ0M7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFDRixHQUFHO0FBQ0QsU0FDRTtBQUFBLElBQUM7QUFBQTtBQUFBLE1BQ0MsV0FBVTtBQUFBLE1BQ1YsSUFBRztBQUFBLE1BQ0gsT0FBT0EsV0FBVyxFQUFFQyxZQUFZLEVBQUUsSUFBSUM7QUFBQUEsTUFFdEMsaUNBQUMsTUFBTSxVQUFOLEVBQWUsVUFBVSxNQUN4QjtBQUFBLFFBQUM7QUFBQTtBQUFBLFVBQ0M7QUFBQSxVQUNBLFdBQVduQixXQUFXb0I7QUFBQUEsVUFDdEIsV0FBV3BCLFdBQVdxQjtBQUFBQSxVQUN0QixlQUFlckIsV0FBV3NCO0FBQUFBLFVBQzFCLG9CQUFvQnRCLFdBQVd1QjtBQUFBQSxVQUMvQjtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQSxZQUFZaEI7QUFBQUEsVUFDWjtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0EsT0FBT0s7QUFBQUEsVUFDUDtBQUFBLFVBQ0EsY0FBYztBQUFBLFVBQ2QsWUFBWUU7QUFBQUEsVUFDWjtBQUFBLFVBQ0EsYUFBYSxJQUFJLEtBQUssS0FBSztBQUFBLFVBQzNCO0FBQUEsVUFDQSxTQUFTRztBQUFBQTtBQUFBQSxRQXhCWDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUF3Qm9CLEtBekJ0QjtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBMkJBO0FBQUE7QUFBQSxJQWhDRjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFpQ0E7QUFFSjtBQUFDTyxNQXpEdUIxQjtBQUFjLElBQUFGLElBQUFDLEtBQUEyQjtBQUFBQyxhQUFBN0IsSUFBQTtBQUFBNkIsYUFBQTVCLEtBQUE7QUFBQTRCLGFBQUFELEtBQUEiLCJuYW1lcyI6WyJSZWFjdCIsIkxpdmVTdGF0cyIsImxhenkiLCJfYyIsIl9jMiIsIkxpdmVTdGF0c1BhbmVsIiwid2FsbGV0QWRkcmVzcyIsImxhc3RNaW50ZWQiLCJiaWdnaU1pbnRlZCIsIm1heFN1cHBseSIsInRpY2tldE1pbnRlZCIsIm1heFRpY2tldHMiLCJ0aWNrZXRQcmljZSIsImJsb2NrTWludENvdW50cyIsIkJBQ0tHUk9VTkRfTkFNRVMiLCJibG9ja1ByaWNlcyIsImJhY2tncm91bmRNaW50Q291bnRzIiwicmV3YXJkUG9vbCIsIm15Q2xhaW1hYmxlIiwibXlORlRzIiwibWludFZvbHVtZU1hdGljIiwiZXBvY2hTdGFydFRzIiwidXNlckxhc3RDbGFpbVRzIiwiZmV0Y2hDaGFpbk5vd1RzIiwiaXNNb2JpbGUiLCJwYWRkaW5nVG9wIiwidW5kZWZpbmVkIiwiaW1hZ2UiLCJ0b2tlbklkIiwiYmxvY2tOYW1lIiwiYmFja2dyb3VuZE5hbWUiLCJfYzMiLCIkUmVmcmVzaFJlZyQiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiTGl2ZVN0YXRzUGFuZWwuanN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFJlYWN0IGZyb20gXCJyZWFjdFwiO1xuXG5jb25zdCBMaXZlU3RhdHMgPSBSZWFjdC5sYXp5KCgpID0+IGltcG9ydChcIi4uL0xpdmVTdGF0c1wiKSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIExpdmVTdGF0c1BhbmVsKHtcbiAgd2FsbGV0QWRkcmVzcyxcbiAgbGFzdE1pbnRlZCxcbiAgYmlnZ2lNaW50ZWQsXG4gIG1heFN1cHBseSxcbiAgdGlja2V0TWludGVkLFxuICBtYXhUaWNrZXRzLFxuICB0aWNrZXRQcmljZSxcbiAgYmxvY2tNaW50Q291bnRzLFxuICBCQUNLR1JPVU5EX05BTUVTLFxuICBibG9ja1ByaWNlcyxcbiAgYmFja2dyb3VuZE1pbnRDb3VudHMsXG4gIHJld2FyZFBvb2wsXG4gIG15Q2xhaW1hYmxlLFxuICBteU5GVHMsXG4gIG1pbnRWb2x1bWVNYXRpYyxcbiAgZXBvY2hTdGFydFRzLFxuICB1c2VyTGFzdENsYWltVHMsXG4gIGZldGNoQ2hhaW5Ob3dUcyxcbiAgaXNNb2JpbGUsXG59KSB7XG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgY2xhc3NOYW1lPVwid2lkZ2V0LWNlbnRlci13cmFwcGVyXCJcbiAgICAgIGlkPVwibGl2ZS1zdGF0c1wiXG4gICAgICBzdHlsZT17aXNNb2JpbGUgPyB7IHBhZGRpbmdUb3A6IDggfSA6IHVuZGVmaW5lZH1cbiAgICA+XG4gICAgICA8UmVhY3QuU3VzcGVuc2UgZmFsbGJhY2s9e251bGx9PlxuICAgICAgICA8TGl2ZVN0YXRzXG4gICAgICAgICAgd2FsbGV0QWRkcmVzcz17d2FsbGV0QWRkcmVzc31cbiAgICAgICAgICBsYXN0SW1hZ2U9e2xhc3RNaW50ZWQuaW1hZ2V9XG4gICAgICAgICAgbGFzdE5mdElkPXtsYXN0TWludGVkLnRva2VuSWR9XG4gICAgICAgICAgbGFzdEJsb2NrTmFtZT17bGFzdE1pbnRlZC5ibG9ja05hbWV9XG4gICAgICAgICAgbGFzdEJhY2tncm91bmROYW1lPXtsYXN0TWludGVkLmJhY2tncm91bmROYW1lfVxuICAgICAgICAgIGJpZ2dpTWludGVkPXtiaWdnaU1pbnRlZH1cbiAgICAgICAgICBtYXhTdXBwbHk9e21heFN1cHBseX1cbiAgICAgICAgICB0aWNrZXRNaW50ZWQ9e3RpY2tldE1pbnRlZH1cbiAgICAgICAgICBtYXhUaWNrZXRzPXttYXhUaWNrZXRzfVxuICAgICAgICAgIHRpY2tldFByaWNlPXt0aWNrZXRQcmljZX1cbiAgICAgICAgICBibG9ja01pbnRDb3VudHM9e2Jsb2NrTWludENvdW50c31cbiAgICAgICAgICBibG9ja05hbWVzPXtCQUNLR1JPVU5EX05BTUVTfVxuICAgICAgICAgIGJsb2NrUHJpY2VzPXtibG9ja1ByaWNlc31cbiAgICAgICAgICBiYWNrZ3JvdW5kTWludENvdW50cz17YmFja2dyb3VuZE1pbnRDb3VudHN9XG4gICAgICAgICAgcmV3YXJkUG9vbD17cmV3YXJkUG9vbH1cbiAgICAgICAgICBteUNsYWltYWJsZT17bXlDbGFpbWFibGV9XG4gICAgICAgICAgaXRlbXM9e215TkZUc31cbiAgICAgICAgICBtaW50Vm9sdW1lTWF0aWM9e21pbnRWb2x1bWVNYXRpY31cbiAgICAgICAgICBzaGFyZVBlcmNlbnQ9ezIyfVxuICAgICAgICAgIGVwb2NoU3RhcnQ9e2Vwb2NoU3RhcnRUc31cbiAgICAgICAgICB1c2VyTGFzdENsYWltVHM9e3VzZXJMYXN0Q2xhaW1Uc31cbiAgICAgICAgICB3ZWVrU2Vjb25kcz17NyAqIDI0ICogNjAgKiA2MH1cbiAgICAgICAgICBmZXRjaENoYWluTm93VHM9e2ZldGNoQ2hhaW5Ob3dUc31cbiAgICAgICAgICBjb21wYWN0PXtpc01vYmlsZX1cbiAgICAgICAgLz5cbiAgICAgIDwvUmVhY3QuU3VzcGVuc2U+XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbiJdLCJmaWxlIjoiQzovZGV2L0JJR0dJTkZUV0VCL3NyYy9jb21wb25lbnRzL2xheW91dC9MaXZlU3RhdHNQYW5lbC5qc3gifQ==
