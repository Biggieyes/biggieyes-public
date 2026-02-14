// src/components/panels/InfoPanel.jsx
import * as React from "react";

/**
 * Robust info panel with structured blocks about the project, tokenomics, and contacts.
 * Accepts children (fallback) or renders default content when no data is provided.
 */
export default function InfoPanel({
  children,
  compact = false,
  data = null,
  loading = false,
  onRefresh,
}) {
  const hasData = Boolean(data);
  const showDefault = !children && !hasData;

  return (
    <section
      className="biggi-card biggi-skin"
      role="region"
      aria-label="Info panel"
      tabIndex={-1}
      style={{
        padding: compact ? 12 : 20,
        display: "grid",
        gap: compact ? 12 : 16,
      }}
    >
      {hasData && (
        <DynamicContent
          data={data}
          compact={compact}
          loading={loading}
          onRefresh={onRefresh}
        />
      )}
      {children && <div style={{ opacity: 0.9 }}>{children}</div>}
      {showDefault && <DefaultContent compact={compact} />}
    </section>
  );
}

function ExplorerLink({ addr, label }) {
  if (!addr) return <span>{label}</span>;
  const url = `https://amoy.polygonscan.com/address/${addr}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{ color: "var(--biggi-accent, #6cf)" }}
    >
      {label}
    </a>
  );
}

function DynamicContent({ data, compact, loading, onRefresh }) {
  const { rpc, snapshot, REWARDS, POLICY, addresses } = data || {};
  return (
    <div style={{ display: "grid", gap: compact ? 12 : 16 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Badge>{rpc?.url ? `RPC: ${rpc.url}` : "RPC: (unknown)"}</Badge>
        <Badge>
          {rpc?.latencyMs != null ? `latency ${rpc.latencyMs} ms` : "latency n/a"}
        </Badge>
        <Badge>{rpc?.error ? `RPC error: ${rpc.error}` : "RPC OK"}</Badge>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        )}
      </div>

      <Block title="Snapshot (reader)" compact={compact}>
        <Stat label="Ticket price (POL)" value={snapshot?.ticketPriceEth ?? "-"} />
        <Stat label="Ticket minted" value={snapshot?.ticketMinted ?? "-"} />
        <Stat label="BIGGI minted" value={snapshot?.biggiMinted ?? "-"} />
        <Stat
          label="Reader"
          value={
            <ExplorerLink
              addr={addresses?.reader}
              label={shortAddr(addresses?.reader)}
            />
          }
        />
      </Block>

      <Block title="REWARDS / Treasury" compact={compact}>
        <Stat label="Reward pool (POL)" value={REWARDS?.rewardPoolEth ?? "-"} />
        <Stat label="Treasury balance (POL)" value={REWARDS?.treasuryEth ?? "-"} />
        <Stat label="BUYBACK balance (POL)" value={REWARDS?.BUYBACKEth ?? "-"} />
        <Stat label="Reserve balance (POL)" value={REWARDS?.reserveEth ?? "-"} />
      </Block>

      <Block title="POLICY / tokenomics" compact={compact}>
        <Stat
          label="swapSlippageBps"
          value={POLICY?.swapSlippageBps ?? "-"}
        />
        <Stat
          label="buybacksPaused"
          value={
            POLICY?.buybacksPaused == null ? "-" : String(POLICY.buybacksPaused)
          }
        />
        <Stat
          label="Main"
          value={
            <ExplorerLink addr={addresses?.main} label={shortAddr(addresses?.main)} />
          }
        />
        <Stat
          label="REWARDS"
          value={
            <ExplorerLink
              addr={addresses?.REWARDS}
              label={shortAddr(addresses?.REWARDS)}
            />
          }
        />
        <Stat
          label="BUYBACK"
          value={
            <ExplorerLink
              addr={addresses?.BUYBACK}
              label={shortAddr(addresses?.BUYBACK)}
            />
          }
        />
      </Block>
    </div>
  );
}

function shortAddr(addr) {
  if (!addr) return "-";
  const a = String(addr);
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function Block({ title, children, compact }) {
  return (
    <div style={{ display: "grid", gap: compact ? 6 : 8 }}>
      <h3 style={{ margin: 0, fontSize: compact ? 16 : 18, lineHeight: 1.25 }}>
        {title}
      </h3>
      <div style={{ fontSize: compact ? 13 : 14, lineHeight: 1.6, opacity: 0.92 }}>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ opacity: 0.8 }}>{label}</span>
      <strong
        style={{
          color: accent ?? "var(--biggi-accent, #6cf)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: 12,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </span>
  );
}

function DefaultContent({ compact }) {
  return (
    <div style={{ display: "grid", gap: compact ? 14 : 18 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Badge>Polygon Amoy · Testnet</Badge>
        <Badge>On-chain NFT lottery</Badge>
        <Badge>DeFi tokenomics</Badge>
        <Badge>VRF + rewards</Badge>
        <Badge>BUYBACK & Treasury</Badge>
        <Badge>Liquidity & REWARDS</Badge>
      </div>

      <Block title="What we are building" compact={compact}>
        A gamified on-chain NFT lottery with dynamic block pricing, an integrated
        BIGGI token, and weekly reward pools. Minting and payouts are on-chain;
        the front-end uses read-only providers on Polygon Amoy.
      </Block>

      <Block title="How it works" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Block prices increase; reader contracts provide prices and counts.</li>
          <li>VRF router ensures fair draws; rewards are paid from the pool.</li>
          <li>BUYBACK and treasury contracts handle tokenomic flow.</li>
          <li>Liquidity manager keeps POL liquidity and funds reward pools.</li>
        </ul>
      </Block>

      <Block title="Tokenomics (high-level)" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Primary flow: mint → fees → treasury / REWARDS / BUYBACK.</li>
          <li>Weekly reward pool: dynamic share of mint volume.</li>
          <li>BUYBACK agent can recapitalize rewards or burn tokens.</li>
        </ul>
      </Block>

      <Block title="Key addresses" compact={compact}>
        <Stat label="Main" value="0x36D5...200A" />
        <Stat label="Reader" value="0x55DF...9FD0" />
        <Stat label="REWARDS" value="0x5952...3F39" />
        <Stat label="Tokenomics reader" value="0xF0A8...23E8" />
        <Stat label="Liquidity manager" value="0x1f60...b56e" />
        <Stat label="BUYBACK agent" value="0xB775...5F8e" />
      </Block>

      <Block title="Roadmap / status" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Mint + VRF + REWARDS deployed on Amoy, read via reader.</li>
          <li>UI panels: lottery, community center, stats.</li>
          <li>RPC monitoring: prefer public nodes, keep fallback minimal.</li>
          <li>Add additional public RPCs if needed.</li>
        </ul>
      </Block>

      <Block title="Quick tips" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Check network (Polygon Amoy) and refresh RPC if data fails.</li>
          <li>Keep RPC fallback to public node only (see .env).</li>
          <li>VRF and rewards are read-only; CALL_EXCEPTION means RPC issue.</li>
          <li>Transactions are testnet-only; no private keys stored in-app.</li>
        </ul>
      </Block>

      <Block title="Contact / support" compact={compact}>
        <div style={{ display: "grid", gap: 4 }}>
          <span>Web: biggieyes.com</span>
          <span>API: biggieyes.com/.netlify/functions</span>
          <span>Testnet: Polygon Amoy (chainId 80002)</span>
          <span>Docs / README: see repo README + REFACTORING_SUMMARY</span>
        </div>
      </Block>
    </div>
  );
}
