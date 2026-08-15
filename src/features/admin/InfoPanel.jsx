// src/components/panels/InfoPanel.jsx
import * as React from "react";
import { ADDR } from "@/shared/utils/addresses.js";

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
  if (!isAddressLike(addr)) return <span>{label || "-"}</span>;
  const url = `https://polygonscan.com/address/${addr}`;
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
  const resolved = resolveInfoAddresses(addresses);
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
              addr={resolved.reader}
              label={shortAddr(resolved.reader)}
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
            <ExplorerLink addr={resolved.main} label={shortAddr(resolved.main)} />
          }
        />
        <Stat
          label="Collection Rewards"
          value={
            <ExplorerLink
              addr={resolved.collectionRewards}
              label={shortAddr(resolved.collectionRewards)}
            />
          }
        />
        <Stat
          label="Token Rewards"
          value={
            <ExplorerLink
              addr={resolved.tokenRewards}
              label={shortAddr(resolved.tokenRewards)}
            />
          }
        />
        <Stat
          label="BUYBACK"
          value={
            <ExplorerLink
              addr={resolved.buyback}
              label={shortAddr(resolved.buyback)}
            />
          }
        />
      </Block>

      <MainnetAddressBlock compact={compact} addresses={resolved} />
      <UserInfoBlocks compact={compact} />
    </div>
  );
}

function isAddressLike(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(addr || ""));
}

function pickAddress(...values) {
  return values.find(isAddressLike) || "";
}

function resolveInfoAddresses(input = {}) {
  return {
    main: pickAddress(input?.main, ADDR.COLLECTION_VRF, ADDR.MAIN),
    publicMain: pickAddress(input?.publicMain, ADDR.COLLECTION_PUBLIC, ADDR.MAIN2),
    ticketHub: pickAddress(input?.ticketHub, ADDR.TICKET_HUB),
    reader: pickAddress(input?.reader, ADDR.MAIN_READER, ADDR.READER),
    chapterSeriesReader: pickAddress(ADDR.CHAPTER_SERIES_READER),
    vrfRouter: pickAddress(input?.vrfRouter, ADDR.VRF_ROUTER),
    distributor: pickAddress(input?.distributor, ADDR.DISTRIBUTOR),
    collectionRewards: pickAddress(
      input?.REWARDS,
      input?.collectionRewards,
      ADDR.COLLECTION_REWARDS,
    ),
    tokenRewards: pickAddress(input?.tokenRewards, ADDR.TOKEN_REWARDS),
    nftRewards: pickAddress(input?.nftRewards, ADDR.NFT_REWARDS),
    token: pickAddress(input?.token, ADDR.BIGGI_TOKEN, ADDR.BIGGI),
    reserve: pickAddress(input?.reserve, ADDR.RESERVE),
    treasury: pickAddress(input?.treasury, ADDR.TREASURY),
    buyback: pickAddress(input?.BUYBACK, input?.buyback, ADDR.BUYBACK_AGENT),
    dripDistributor: pickAddress(input?.dripDistributor, ADDR.DRIP_DISTRIBUTOR),
    dripLM: pickAddress(input?.dripLM, ADDR.DRIP_LM),
    liquidityManager: pickAddress(input?.liquidityManager, ADDR.LM),
    liquidityVault: pickAddress(input?.liquidityVault, ADDR.LIQUIDITY_VAULT),
    pair: pickAddress(input?.pair, ADDR.PAIR),
    router: pickAddress(input?.router, ADDR.ROUTER),
    tokenomicsStatusReader: pickAddress(
      ADDR.BIGGI_TOKENOMICS_READER,
      ADDR.TOKENOMIK_READER,
    ),
    tokenomicsAddonReader: pickAddress(ADDR.TOKENOMICS_SYSTEM_ADDON_READER),
  };
}

function MainnetAddressBlock({ compact, addresses = resolveInfoAddresses() }) {
  const rows = [
    ["VRF collection", addresses.main],
    ["Public collection", addresses.publicMain],
    ["Ticket Hub", addresses.ticketHub],
    ["Main reader", addresses.reader],
    ["Chapter/Series reader", addresses.chapterSeriesReader],
    ["VRF router", addresses.vrfRouter],
    ["Distributor", addresses.distributor],
    ["Collection Rewards", addresses.collectionRewards],
    ["NFT Rewards", addresses.nftRewards],
    ["BIGGI token", addresses.token],
    ["Token Rewards", addresses.tokenRewards],
    ["Reserve", addresses.reserve],
    ["Treasury", addresses.treasury],
    ["Buyback Agent", addresses.buyback],
    ["DRIP Distributor", addresses.dripDistributor],
    ["DRIP LM", addresses.dripLM],
    ["Liquidity Manager", addresses.liquidityManager],
    ["Liquidity Vault", addresses.liquidityVault],
    ["DEX pair", addresses.pair],
    ["DEX router", addresses.router],
    ["Tokenomics status reader", addresses.tokenomicsStatusReader],
    ["Tokenomics addon reader", addresses.tokenomicsAddonReader],
  ].filter(([, addr]) => isAddressLike(addr));

  return (
    <Block title="Mainnet contracts" compact={compact}>
      <div style={{ display: "grid", gap: compact ? 4 : 6 }}>
        {rows.map(([label, addr]) => (
          <Stat
            key={label}
            label={label}
            value={<ExplorerLink addr={addr} label={shortAddr(addr)} />}
          />
        ))}
      </div>
    </Block>
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

function UserInfoBlocks({ compact }) {
  return (
    <>
      <Block title="Quickstart (2 min)" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Connect a wallet (MetaMask or compatible).</li>
          <li>Switch network to Polygon mainnet (chainId 137).</li>
          <li>Keep enough POL for mainnet gas.</li>
          <li>Mint creates a ticket NFT; confirm in your wallet.</li>
          <li>When eligible, use Redeem or Claim and confirm the transaction.</li>
          <li>Use explorer links in the UI to verify on-chain status.</li>
        </ul>
      </Block>

      <Block title="How mint / redeem / claim works" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Mint = on-chain ticket NFT + entry into the current round.</li>
          <li>Redeem = execute eligible redemption on-chain.</li>
          <li>Claim = collect reward when your ticket is eligible.</li>
          <li>Randomness uses Chainlink VRF and is verifiable on-chain.</li>
          <li>All state is authoritative on-chain; UI only reads data.</li>
        </ul>
      </Block>

      <Block title="Schemas (on-chain flow)" compact={compact}>
        <div
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: compact ? 12 : 13,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            opacity: 0.9,
          }}
        >
{`Ticket mint -> TicketHub -> Ticket NFT
Protocol share -> Distributor
Distributor -> Reserve | Buyback | Treasury | CollectionRewards | Community
Buyback -> Treasury
Treasury -> TokenRewards + Reserve + DRIP
Reserve -> LiquidityManager -> LiquidityVault`}
        </div>
      </Block>

      <Block title="Wallet and network" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Network: Polygon mainnet (chainId 137).</li>
          <li>Gas: you need POL for transactions.</li>
          <li>Account: connect the same wallet you minted with.</li>
        </ul>
      </Block>

      <Block title="Transaction status" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Pending means the transaction is waiting to be confirmed.</li>
          <li>Use the explorer link to check confirmations and status.</li>
          <li>If pending too long, you can speed up or cancel in your wallet.</li>
          <li>Failed or rejected transactions show an error in the status banner.</li>
        </ul>
      </Block>

      <Block title="On-chain verification" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Contract addresses and explorers are listed in the Trust tab.</li>
          <li>Supply caps, rewards, and reserve balances are enforced on-chain.</li>
          <li>Readers aggregate snapshots for fast UI rendering.</li>
        </ul>
      </Block>
      <Block title="Common issues" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Wrong network: switch to Polygon mainnet (chainId 137).</li>
          <li>No data: refresh the panel or reconnect your wallet.</li>
          <li>RPC degraded: retry or switch to a public RPC in settings.</li>
          <li>Images missing: IPFS can be slow; wait or refresh the page.</li>
        </ul>
      </Block>

      <Block title="Security notes" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>The app never asks for private keys or seed phrases.</li>
          <li>Only approve transactions you expect; check the method name.</li>
          <li>All critical balances are on-chain and verifiable.</li>
        </ul>
      </Block>

      <Block title="Mainnet notice" compact={compact}>
        MAINNET DEPLOYMENT. Transactions use real POL and must be checked in
        the wallet before confirmation.
      </Block>

      <Block title="Support and references" compact={compact}>
        <div style={{ display: "grid", gap: 4 }}>
          <span>Web: biggieyes.com</span>
          <span>API: biggieyes.com/.netlify/functions</span>
          <span>Network: Polygon mainnet (chainId 137)</span>
          <span>Docs: README.md, REFACTORING_SUMMARY.md, Trust tab</span>
        </div>
      </Block>
    </>
  );
}

function DefaultContent({ compact }) {
  return (
    <div style={{ display: "grid", gap: compact ? 14 : 18 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Badge>Polygon mainnet</Badge>
        <Badge>On-chain transparency</Badge>
        <Badge>Reader contracts</Badge>
        <Badge>VRF randomness</Badge>
        <Badge>Treasury / Buyback / Reserve</Badge>
        <Badge>Real mainnet transactions</Badge>
      </div>

      <MainnetAddressBlock compact={compact} />

      <UserInfoBlocks compact={compact} />
    </div>
  );
}
