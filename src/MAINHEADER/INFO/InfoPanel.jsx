// src/components/panels/InfoPanel.jsx
import * as React from "react";

/**
 * Robustnější info panel: strukturované bloky o projektu, tokenomice a kontaktech.
 * Přijímá buď children (fallback), nebo si vyrenderuje default content, pokud nejsou děti.
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
  const { rpc, snapshot, rewards, policy, addresses } = data || {};
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
        <Badge>{rpc?.url ? `RPC: ${rpc.url}` : "RPC: (neznámé)"}</Badge>
        <Badge>
          {rpc?.latencyMs != null
            ? `latence ${rpc.latencyMs} ms`
            : "latence n/a"}
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
            {loading ? "Načítám…" : "Obnovit"}
          </button>
        )}
      </div>

      <Block title="Snapshot (reader)" compact={compact}>
        <Stat
          label="Ticket price (POL)"
          value={snapshot?.ticketPriceEth ?? "-"}
        />
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

      <Block title="Rewards / Treasury" compact={compact}>
        <Stat label="Reward pool (POL)" value={rewards?.rewardPoolEth ?? "-"} />
        <Stat
          label="Treasury balance (POL)"
          value={rewards?.treasuryEth ?? "-"}
        />
        <Stat
          label="Buyback balance (POL)"
          value={rewards?.buybackEth ?? "-"}
        />
        <Stat
          label="Reserve balance (POL)"
          value={rewards?.reserveEth ?? "-"}
        />
      </Block>

      <Block title="Policy / tokenomika" compact={compact}>
        <Stat label="gammaStakingBps" value={policy?.gammaBps ?? "-"} />
        <Stat
          label="Main"
          value={
            <ExplorerLink
              addr={addresses?.main}
              label={shortAddr(addresses?.main)}
            />
          }
        />
        <Stat
          label="Rewards"
          value={
            <ExplorerLink
              addr={addresses?.rewards}
              label={shortAddr(addresses?.rewards)}
            />
          }
        />
        <Stat
          label="Buyback"
          value={
            <ExplorerLink
              addr={addresses?.buyback}
              label={shortAddr(addresses?.buyback)}
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
      <div
        style={{ fontSize: compact ? 13 : 14, lineHeight: 1.6, opacity: 0.92 }}
      >
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
        <Badge>On-chain NFT loterie</Badge>
        <Badge>DeFi tokenomika</Badge>
        <Badge>VRF + odměny</Badge>
        <Badge>Buyback & Treasury</Badge>
        <Badge>Liquidity & Rewards</Badge>
      </div>

      <Block title="Co stavíme" compact={compact}>
        Gamifikovanou on-chain NFT loterii s dynamickým pricingem bloků,
        integrovaným tokenem BIGGI a týdenními reward pooly. Mintování i výplaty
        jsou on-chain; front-end používá read-only providery na Polygon Amoy.
      </Block>

      <Block title="Jak to funguje" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>
            Bloky NFT mají rostoucí ceny; ceny i počty mintů čte reader
            kontrakt.
          </li>
          <li>
            VRF router zajišťuje férové losování; odměny se vyplácí z reward
            poolu.
          </li>
          <li>
            Buyback a treasury kontrakty spravují tokonomiku a udržitelnost
            poolů.
          </li>
          <li>
            Liquidity manager drží POL likviditu a krmí pooly odměn podle
            parametrů politiky.
          </li>
        </ul>
      </Block>

      <Block title="Tokenomika (high-level)" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>
            Primární tok: mint -&gt; fee -&gt; rozdělení mezi treasury, rewards,
            buyback.
          </li>
          <li>
            Weekly reward pool: dynamický podíl z mint volume (viz kontrakt
            LM/Rewards).
          </li>
          <li>
            Buyback agent: může rekapitalizovat odměny nebo řídit spalování
            tokenu.
          </li>
        </ul>
      </Block>

      <Block title="Klíčové adresy" compact={compact}>
        <Stat label="Main" value="0x36D5...200A" />
        <Stat label="Reader" value="0x55DF...9FD0" />
        <Stat label="Rewards" value="0x5952...3F39" />
        <Stat label="Tokenomics reader" value="0xF0A8...23E8" />
        <Stat label="Liquidity manager" value="0x1f60...b56e" />
        <Stat label="Buyback agent" value="0xB775...5F8e" />
      </Block>

      <Block title="Roadmap / stav" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>✅ Mint + VRF + rewards: nasazeno na Amoy, čteno přes reader.</li>
          <li>✅ UI panely: lottery, community center, stats.</li>
          <li>
            🛠 Monitoring RPC spolehlivosti: preferujeme publicnode, bez Ankr
            fallbacku.
          </li>
          <li>
            🔜 Přidat další veřejné RPC jako záložní (pokud bude potřeba).
          </li>
        </ul>
      </Block>

      <Block title="Rychlé tipy" compact={compact}>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>
            Pokud se nenačtou data, zkontroluj síť (Polygon Amoy) a obnov RPC
            (localStorage: biggi_last_amoy_rpc_v1).
          </li>
          <li>
            Pro jistotu nech povolený fallback jen na public node (viz .env:
            VITE_JSON_RPC_URL).
          </li>
          <li>
            VRF a odměny jsou read-only — chyby typu CALL_EXCEPTION znamenají
            nejčastěji špatný RPC nebo timeout.
          </li>
          <li>
            UI čte jen read-only; transakce na testnetu nevyžadují soukromé
            klíče v prohlížeči mimo podpisů.
          </li>
        </ul>
      </Block>

      <Block title="Kontakt / support" compact={compact}>
        <div style={{ display: "grid", gap: 4 }}>
          <span>Web: biggieyes.com</span>
          <span>API: biggieyes.com/.netlify/functions</span>
          <span>Testnet: Polygon Amoy (chainId 80002)</span>
          <span>Docs / README: v repu (sekce README, REFACTORING_SUMMARY)</span>
        </div>
      </Block>
    </div>
  );
}

