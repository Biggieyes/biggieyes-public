import * as React from "react";
import copy from "clipboard-copy";
import { useWeb3 } from "@/providers/Web3Provider";
import { chainNameFor, explorerBaseFor } from "@/config/chains.js";
import { ADDR } from "@/shared/utils/addresses";
import PanelInfoModal from "@/components/common/PanelInfoModal";
import "./USERPANEL.css";

function shortAddress(addr) {
  if (!addr) return "--";
  const s = String(addr);
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

function ExplorerLink({ address, chainId, label }) {
  if (!address) return <span className="muted">--</span>;
  const base = explorerBaseFor(chainId) || "https://etherscan.io";
  const href = `${base}/address/${address}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="user-panel__link"
    >
      {label || shortAddress(address)}
    </a>
  );
}

export default function USERPANEL() {
  const { account, chainId, connectMetaMask, isConnecting } = useWeb3();
  const [copied, setCopied] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(false);

  const infoItems = React.useMemo(
    () => [
      {
        label: "CONNECT WALLET",
        description: [
          "Connects your wallet to read balances, claims, and referrals.",
          "Required for redeem, claim, and on-chain actions.",
        ],
      },
      {
        label: "COPY REFERRAL",
        description: [
          "Copies your referral link to share with friends.",
          "Links are generated from your connected wallet address.",
        ],
      },
      {
        label: "REFRESH CONNECTION",
        description: [
          "Re-checks wallet connection and network status.",
          "Use if the chain changes or wallet reconnects.",
        ],
      },
    ],
    [],
  );

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = account ? `${baseUrl}?ref=${account}` : "";
  const connected = Boolean(account);
  const connectionPct = connected ? 100 : 0;
  const referralPct = referralLink ? 100 : 0;

  const handleCopy = React.useCallback(async () => {
    if (!referralLink) return;
    try {
      await copy(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [referralLink]);

  const contracts = [
    { label: "Main", address: ADDR.MAIN },
    { label: "Token", address: ADDR.BIGGI },
    { label: "Token REWARDS", address: ADDR.TOKEN_REWARDS },
    { label: "Collection REWARDS", address: ADDR.COLLECTION_REWARDS },
    { label: "VRF Router", address: ADDR.VRF_ROUTER },
  ];

  return (
    <div className="user-panel">
      <section className="user-panel__surface">
        <header className="user-panel__header">
          <div>
            <h2 className="user-panel__title">User Panel</h2>
            <p className="user-panel__subtitle">
              Wallet status, referrals, and core contract shortcuts in one
              place.
            </p>
          </div>
          <div className="user-panel__header-actions">
            <button
              type="button"
              className="user-panel__btn user-panel__btn--accent"
              onClick={connectMetaMask}
              disabled={isConnecting}
            >
              {connected ? "Wallet connected" : "Connect wallet"}
            </button>
            <button
              type="button"
              className="panel-info-btn biggi-btn biggi-btn--ghost"
              onClick={() => setInfoOpen(true)}
              aria-label="User panel buttons info"
            >
              <span>i</span>
            </button>
          </div>
        </header>

        <div className="user-panel__hero">
          <div className="user-panel__hero-grid">
            <div className="user-panel__hero-card">
              <span className="user-panel__hero-label">Wallet status</span>
              <span className="user-panel__hero-value">
                {connected ? "Connected" : "Disconnected"}
              </span>
              <span className="user-panel__hero-hint">
                {connected ? shortAddress(account) : "Connect to begin"}
              </span>
            </div>
            <div className="user-panel__hero-card">
              <span className="user-panel__hero-label">Network</span>
              <span className="user-panel__hero-value">
                {chainNameFor(chainId)}
              </span>
              <span className="user-panel__hero-hint">
                Chain ID: {chainId || "--"}
              </span>
            </div>
            <div className="user-panel__hero-card">
              <span className="user-panel__hero-label">Referral link</span>
              <span className="user-panel__hero-value">
                {referralLink ? "Ready" : "Locked"}
              </span>
              <span className="user-panel__hero-hint">
                {referralLink ? "Share with your community" : "Connect wallet"}
              </span>
            </div>
            <div className="user-panel__hero-card">
              <span className="user-panel__hero-label">Contracts</span>
              <span className="user-panel__hero-value">
                {contracts.length}
              </span>
              <span className="user-panel__hero-hint">
                Quick links to core modules
              </span>
            </div>
          </div>

          <div className="user-panel__quick-actions">
            <button
              type="button"
              className="user-panel__btn user-panel__btn--ghost"
              onClick={handleCopy}
              disabled={!referralLink}
            >
              {copied ? "Copied" : "Copy referral"}
            </button>
            <button
              type="button"
              className="user-panel__btn user-panel__btn--ghost"
              onClick={connectMetaMask}
              disabled={isConnecting}
            >
              {connected ? "Refresh connection" : "Connect MetaMask"}
            </button>
          </div>
        </div>

        <div className="user-panel__visuals">
          <div className="user-panel__card user-panel__card--visual">
            <div className="user-panel__card-head">
              <h3>Connection health</h3>
              <span className="user-panel__chip">
                {connected ? "Online" : "Offline"}
              </span>
            </div>
            <div className="user-panel__visual-body">
              <div
                className="user-panel__chart-ring"
                style={{ "--pct": connectionPct }}
              >
                <div className="user-panel__chart-ring-center">
                  <strong>{connectionPct}%</strong>
                  <span>Status</span>
                </div>
              </div>
              <div className="user-panel__visual-meta">
                <div>
                  <span className="user-panel__meta-label">Wallet</span>
                  <span className="user-panel__meta-value">
                    {connected ? shortAddress(account) : "--"}
                  </span>
                </div>
                <div className="user-panel__meta-bar">
                  <span style={{ width: `${connectionPct}%` }} />
                </div>
                <div>
                  <span className="user-panel__meta-label">Network</span>
                  <span className="user-panel__meta-value">
                    {chainNameFor(chainId)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="user-panel__card user-panel__card--visual">
            <div className="user-panel__card-head">
              <h3>Referral readiness</h3>
              <span className="user-panel__chip user-panel__chip--cyan">
                {referralLink ? "Active" : "Locked"}
              </span>
            </div>
            <div className="user-panel__visual-body">
              <div
                className="user-panel__chart-ring user-panel__chart-ring--cyan"
                style={{ "--pct": referralPct }}
              >
                <div className="user-panel__chart-ring-center">
                  <strong>{referralPct}%</strong>
                  <span>Link</span>
                </div>
              </div>
              <div className="user-panel__visual-meta">
                <div>
                  <span className="user-panel__meta-label">Referral link</span>
                  <span className="user-panel__meta-value">
                    {referralLink ? "Generated" : "Not set"}
                  </span>
                </div>
                <div className="user-panel__meta-bar user-panel__meta-bar--cyan">
                  <span style={{ width: `${referralPct}%` }} />
                </div>
                <div>
                  <span className="user-panel__meta-label">Copy status</span>
                  <span className="user-panel__meta-value">
                    {copied ? "Copied" : "Ready"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="user-panel__grid user-panel__grid--primary">
          <div className="user-panel__card">
            <h3>Wallet</h3>
            <div className="user-panel__statline">
              <span>Address</span>
              <strong>{connected ? shortAddress(account) : "--"}</strong>
            </div>
            <div className="user-panel__statline">
              <span>Network</span>
              <strong>{chainNameFor(chainId)}</strong>
            </div>
            <div className="user-panel__statline">
              <span>Explorer</span>
              <ExplorerLink
                address={account}
                chainId={chainId}
                label={connected ? "Open wallet" : "--"}
              />
            </div>
          </div>

          <div className="user-panel__card">
            <h3>Referral</h3>
            <p className="user-panel__muted">
              Share your referral link to track verified community invites.
            </p>
            <div className="user-panel__statline">
              <input
                type="text"
                readOnly
                value={referralLink || "Connect wallet to generate link"}
                style={{ width: "100%" }}
              />
            </div>
            <button
              type="button"
              className="user-panel__btn user-panel__btn--ghost user-panel__btn--wide"
              onClick={handleCopy}
              disabled={!referralLink}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          <div className="user-panel__card">
            <h3>Contracts</h3>
            <div className="user-panel__grid user-panel__grid--secondary">
              {contracts.map((item) => (
                <div key={item.label} className="user-panel__statline">
                  <span>{item.label}</span>
                  <ExplorerLink
                    address={item.address}
                    chainId={chainId}
                    label={shortAddress(item.address)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="user-panel__grid user-panel__grid--stats">
          <div className="user-panel__stat-card">
            <span className="user-panel__stat-icon">Chain</span>
            <div>
              <span className="user-panel__stat-label">Chain ID</span>
              <span className="user-panel__stat-value">
                {chainId || "--"}
              </span>
            </div>
          </div>
          <div className="user-panel__stat-card">
            <span className="user-panel__stat-icon">Wallet</span>
            <div>
              <span className="user-panel__stat-label">Status</span>
              <span className="user-panel__stat-value">
                {connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <div className="user-panel__stat-card">
            <span className="user-panel__stat-icon">Referral</span>
            <div>
              <span className="user-panel__stat-label">Link</span>
              <span className="user-panel__stat-value">
                {referralLink ? "Active" : "Locked"}
              </span>
            </div>
          </div>
          <div className="user-panel__stat-card">
            <span className="user-panel__stat-icon">Core</span>
            <div>
              <span className="user-panel__stat-label">Contracts</span>
              <span className="user-panel__stat-value">
                {contracts.length}
              </span>
            </div>
          </div>
        </div>

        <PanelInfoModal
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          title="User Panel"
          items={infoItems}
        />
      </section>
    </div>
  );
}
