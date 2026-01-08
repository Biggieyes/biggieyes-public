import * as React from "react";
import { ethers } from "ethers";
import Loader from "../../components/common/Loader.jsx";

// Keeps a faulty panel error from freezing the whole nav; also surfaces the error message
class PanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("Nav panel failed", error, info);
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
    if (typeof this.props.onReset === "function") this.props.onReset();
  };

  render() {
    const { error } = this.state;
    if (error) {
      const msg = error?.message || String(error);
      return (
        <div
          style={{
            padding: 16,
            color: "#f66",
            background: "#130c0c",
            borderRadius: 12,
            border: "1px solid #f66",
          }}
        >
          <p style={{ margin: "0 0 8px" }}>Panel crashed. Close or retry.</p>
          <p style={{ margin: "0 0 8px", color: "#faa" }}>{msg}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => this.handleReset()}
              style={{ padding: "6px 10px" }}
            >
              Retry
            </button>
            <button
              onClick={() => this.props.onClose?.()}
              style={{ padding: "6px 10px" }}
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const RewardsPanel = React.lazy(() => import("./RewardsPanel.jsx"));
const InfoPanel = React.lazy(() => import("./InfoPanel.jsx"));
const VRFPanel = React.lazy(() => import("../VRF/VRFPanel"));
const UserPanel = React.lazy(() => import("../user/UserPanel"));
const BiggiToken = React.lazy(() => import("../../components/TOKEN/BiggiToken.jsx"));
const CollectionBlocksGrid = React.lazy(
  () => import("../../components/CollectionBlocksGrid.jsx"),
);
const CommunityCenterPanel = React.lazy(
  () => import("./CommunityCenterPanel.jsx"),
);

export default function NavPanelSwitch({
  activeAlt,
  modalText,
  transparencyData,
  transparencyLoading,
  refreshTransparency,
  compact = false,
  walletAddress,
  getSignerProvider,
  getROProvider,

  myNFTs,
  myClaimable,
  rewardPool,
  claimRewards,

  blockNames,
  blockPrices,
  blockMintCounts,

  vrfUIData,
  onVRFRequest,
  onVRFRefresh,
  onVRFCancelPending,
  onVRFUpdateParams,
  onVrfOpenExplorer,

  biggiData,
  onRefreshTokenMeta,
  onRefreshRewards,
  onRefreshRouterInfo,
  onRefreshLiquidityPreview,
  onRefreshBuybackInfo,
  onRefreshPolicy,
  fetchTreasuryInfo,
  fetchReserveInfo,
  fetchDistributorInfo,
  distributorData,
  writeFirst,
  getReserve,
  getLiquidityContract,

  connectMetaMask,
  connectWalletConnect,
  ticketPrice,
  biggiMinted,
  maxSupply,
  maxTickets,
  ticketMinted,
  mintVolumeMatic,
  mintTicket,
}) {
  const [tokenPanelReloadKey, setTokenPanelReloadKey] = React.useState(0);
  return (
    <React.Suspense fallback={<Loader text="Loading panel..." size={24} />}>
      {activeAlt === "REWARDS" ? (
        <RewardsPanel
          compact={compact}
          walletAddress={walletAddress}
          provider={(function () {
            try {
              if (
                walletAddress &&
                typeof window !== "undefined" &&
                window.ethereum
              ) {
                return getSignerProvider();
              }
            } catch {}
            try {
              return getROProvider();
            } catch {
              return null;
            }
          })()}
          items={myNFTs}
          claimable={myClaimable}
          rewardPool={rewardPool}
          onClaim={claimRewards}
        />
      ) : activeAlt === "COLLECTION" ? (
        <React.Suspense fallback={<div>Loading Collection...</div>}>
          <CollectionBlocksGrid
            blockNames={blockNames}
            blockPrices={blockPrices}
            blockMintCounts={blockMintCounts}
            compact={compact}
          />
        </React.Suspense>
      ) : activeAlt === "VRF MINT" ? (
        <VRFPanel
          data={vrfUIData}
          walletAddress={walletAddress}
          onRequestRandomness={onVRFRequest}
          onRefresh={onVRFRefresh}
          onCancelPending={onVRFCancelPending}
          onUpdateParams={onVRFUpdateParams}
          onOpenExplorer={onVrfOpenExplorer}
          compact={compact}
        />
      ) : activeAlt === "BIGGI ECOSYSTEM" ? (
        <PanelErrorBoundary
          onReset={() => setTokenPanelReloadKey((v) => v + 1)}
          onClose={activeAlt ? () => onRefreshRouterInfo?.() : undefined}
        >
          <React.Suspense fallback={<div>Loading Token Info...</div>}>
            <BiggiToken
              key={tokenPanelReloadKey}
              data={biggiData}
              walletAddress={walletAddress}
              onRefreshTokenMeta={onRefreshTokenMeta}
              onRefreshRewards={onRefreshRewards}
              onPreviewClaim={onRefreshRewards}
              onCheckClaimStatus={onRefreshRewards}
              onRefreshRouterInfo={onRefreshRouterInfo}
              onRefreshLiquidityPreview={onRefreshLiquidityPreview}
              onRefreshBuybackInfo={onRefreshBuybackInfo}
              onRefreshPolicy={onRefreshPolicy}
              fetchTreasuryInfo={fetchTreasuryInfo}
              fetchReserveInfo={fetchReserveInfo}
              fetchDistributorInfo={fetchDistributorInfo}
              distributorData={distributorData}
              compact={compact}
              onReserveTopUp={async () => {
                try {
                  await writeFirst([getReserve], ["requestTopUpToLM"]);
                } catch (e) {
                  console.error("onReserveTopUp", e);
                  alert(e?.reason || e?.message || "Reserve top-up failed");
                }
              }}
              onBootstrapLiquidity={async ({ tokenAmountWei, nativeEth }) => {
                const amountBN = ethers.BigNumber.from(
                  String(tokenAmountWei || "0"),
                );
                const overrides = {
                  value: ethers.utils.parseEther(String(nativeEth || "0")),
                };
                await writeFirst(
                  [getLiquidityContract],
                  ["bootstrapLiquidity"],
                  amountBN,
                  overrides,
                );
                await onRefreshLiquidityPreview();
              }}
              onAddLiquidityFromBalance={async () => {
                await writeFirst(
                  [getLiquidityContract],
                  ["addLiquidityFromBalance"],
                );
                await onRefreshLiquidityPreview();
              }}
              onBuybackAndSendToTreasury={async ({ minOutWei, nativeEth }) => {
                const minOutBN = ethers.BigNumber.from(
                  String(minOutWei || "0"),
                );
                const overrides = {
                  value: ethers.utils.parseEther(String(nativeEth || "0")),
                };
                await writeFirst(
                  [getLiquidityContract],
                  [
                    "buyBiggiAndSendToTreasury",
                    "buybackAllToTreasury",
                    "buybackToTreasury",
                  ],
                  minOutBN,
                  overrides,
                );
                await onRefreshRouterInfo();
                await onRefreshBuybackInfo();
              }}
            />
          </React.Suspense>
        </PanelErrorBoundary>
      ) : activeAlt === "USERS" ? (
        <UserPanel
          address={walletAddress}
          onConnect={connectMetaMask}
          ticketPrice={ticketPrice}
          minted={biggiMinted}
          maxSupply={maxSupply}
          ticketsLeft={Math.max(0, (maxTickets ?? 0) - (ticketMinted ?? 0))}
          claimable={myClaimable}
          rewardPool={rewardPool}
          mintVolumeMatic={mintVolumeMatic}
          sharePercent={
            biggiData?.policy?.gammaStakingBps != null
              ? Number(biggiData.policy.gammaStakingBps) / 100
              : null
          }
          tokenPrice={biggiData?.token?.price ?? null}
          liquidityPool={
            biggiData?.liquidity?.contractEthBalance != null
              ? `${biggiData.liquidity.contractEthBalance} POL`
              : null
          }
          items={myNFTs}
          onMint={mintTicket}
          onClaim={claimRewards}
          compact={compact}
        />
      ) : activeAlt === "COMMUNITY CENTER" ? (
        <React.Suspense fallback={<div>Loading Community Center...</div>}>
          <CommunityCenterPanel
            compact={compact}
            walletAddress={walletAddress}
            onConnectMetaMask={connectMetaMask}
            onConnectWalletConnect={connectWalletConnect}
          />
        </React.Suspense>
      ) : (
        <InfoPanel
          compact={compact}
          data={transparencyData}
          loading={transparencyLoading}
          onRefresh={refreshTransparency}
        >
          {modalText}
        </InfoPanel>
      )}
    </React.Suspense>
  );
}
