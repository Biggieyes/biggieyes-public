// src/components/CollectionBlocksGrid.jsx
import * as React from "react";
import "./CollectionBlocksGrid.css";

import useIsMobile from "../hooks/useIsMobile";
import useIsTouch from "../hooks/useIsTouch";
import { useStatsRewards } from "../hooks/useStatsRewards";
import {
  DEFAULT_BLOCKS,
  BASE_PRICES,
  ROWS_BY_BLOCK,
  BTN_STYLES,
  FALLBACK_BTN_STYLE,
} from "../constants/blocks";
import {
  handleImageError,
  safeBlockFolder,
  getBlockImages,
  getBlockThumb,
  buildBlockImagePath,
} from "../utils/images";
import { useContracts } from "../providers/ContractsProvider";
import { ensureAmoy } from "../utils/contract";
import { ethers } from "ethers";

// Import constants a utilities
import {
  MOBILE_BREAKPOINT,
  MAX_BLOCKS,
  PREVIEW_SIZE,
  COLLECTION_TABS,
  FALLBACK_VALUE,
  COLLECTION_STATUSES,
  FUTURE_COLLECTIONS,
} from './CollectionBlocksGrid.constants';
import {
  parseCount,
  parsePrice,
  formatPrice,
  formatCount,
  computeDiff,
  isValidPrice,
  isValidCount,
  safeAsyncCall,
  safeSyncCall,
} from "./CollectionBlocksGrid.utils";

// Import sub-komponenty
import BlockCard from "./CollectionBlocksGrid.BlockCard";
import InfoPanel from "./CollectionBlocksGrid.InfoPanel";
import Collection1Panel from "./CollectionBlocksGrid.Collection1Panel";
import Collection2Panel from "./CollectionBlocksGrid.Collection2Panel";
import FutureCollectionsModal from "./CollectionBlocksGrid.FutureCollectionsModal";
import ModalPortal from "./common/ModalPortal";

const ExpansionPanelLazy = React.lazy(() => import("./panels/ExpansionPanel"));
const NOOP = () => {};

const resolveButtonStyle = (name) => {
  const variant = BTN_STYLES[safeBlockFolder(name)] || FALLBACK_BTN_STYLE;
  return {
    background: variant.background,
    borderColor: variant.borderColor,
    color: variant.color,
    boxShadow: variant.shadow,
  };
};

function CollectionBlocksGrid({
  blockNames = [],              // nepovinné override
  blockPrices: blockPricesProp, // nepovinné override
  blockMintCounts: blockMintCountsProp, // nepovinné override
  additionalText = "",
  activeCollection: activeCollectionProp = "collection1",
  onCollectionChange = () => {},
}) {
  const [openBlock, setOpenBlock] = React.useState(null);
  const [hoveredBlock, setHoveredBlock] = React.useState(null);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [futureOpen, setFutureOpen] = React.useState(false);
  const [selectedBlock, setSelectedBlock] = React.useState(1);
  const [selectedBackground, setSelectedBackground] = React.useState(1);
  const [desiredTokenId, setDesiredTokenId] = React.useState("");
  const [collectionMeta, setCollectionMeta] = React.useState({});
  const [onchainUnavailable, setOnchainUnavailable] = React.useState(false);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const futureStats = React.useMemo(() => ({
    totalCollections: 0,
    totalItems: 0,
    avgMintPrice: 0,
    highProgress: 0,
  }), []);

  const isMobile = useIsMobile(MOBILE_BREAKPOINT);
  const isTouch = useIsTouch();

  const [fallbackPrices, setFallbackPrices] = React.useState(Array(MAX_BLOCKS).fill(null));
  const [fallbackMinted, setFallbackMinted] = React.useState(Array(MAX_BLOCKS).fill(null));
  const [fallbackBgMinted, setFallbackBgMinted] = React.useState(Array(MAX_BLOCKS).fill(null));

  const { fetchStats: fetchSnapshotStats } = useStatsRewards({
    setTicketPrice: NOOP,
    setTicketMinted: NOOP,
    setBiggiMinted: NOOP,
    setBlockPrices: setFallbackPrices,
    setBlockMintCounts: setFallbackMinted,
    setBackgroundMintCounts: setFallbackBgMinted,
    setRewardPool: NOOP,
    setMintVolumeMatic: NOOP,
    walletAddress: "",
    myNFTs: [],
    setMyClaimable: NOOP,
  });
  let contracts;
  try {
    contracts = useContracts();
  } catch (error) {
    // don't let contract access crash the component; log and continue
    // eslint-disable-next-line no-console
    console.warn("Failed to get contracts:", error);
    contracts = null;
  }

  // ==== on-chain zdroje ====
  const [livePrices, setLivePrices] = React.useState(Array(MAX_BLOCKS).fill(null));
  const [liveMinted, setLiveMinted] = React.useState(Array(MAX_BLOCKS).fill(null));

  React.useEffect(() => {
    let cancelled = false;

    const fmtPrice = (wei) => safeSyncCall(() => Number(ethers.utils.formatEther(wei)), null);

    const load = async () => {
      try {
        if (!contracts) return;
        const coll = contracts.collectionPublicRead?.();
        if (!coll) return;

        const pausedVal = await safeAsyncCall(() => coll.paused?.());
        const meta = {
          maxSupply: await safeAsyncCall(() => coll.MAX_SUPPLY?.()),
          maxTickets: await safeAsyncCall(() => coll.MAX_TICKETS?.()),
          ticketMinted: await safeAsyncCall(() => coll.ticketMinted?.()),
          biggiMinted: await safeAsyncCall(() => coll.biggiMinted?.()),
          paused: pausedVal === true || pausedVal === 1,
        };

        meta.maxSupply = meta.maxSupply != null ? Number(meta.maxSupply) : null;
        meta.maxTickets = meta.maxTickets != null ? Number(meta.maxTickets) : null;
        meta.ticketMinted = meta.ticketMinted != null ? Number(meta.ticketMinted) : null;
        meta.biggiMinted = meta.biggiMinted != null ? Number(meta.biggiMinted) : null;

        const prices = [];
        const minted = [];

        // Defensive: verify there's contract code at the address before making repeated read calls.
        // If provider.getCode returns '0x' we likely pointed to a non-contract address or wrong network.
        try {
          const providerForCode = coll && coll.provider ? coll.provider : null;
          const code = providerForCode ? await safeAsyncCall(() => providerForCode.getCode(coll.address)) : null;
          if (!code || code === "0x" || code === "0x0") {
            // eslint-disable-next-line no-console
            console.warn("Collection contract not found at address, skipping block reads:", coll.address, code);
            // mark as unavailable so UI can show a friendly notice
            setOnchainUnavailable(true);
            // leave prices/minted as null arrays
            for (let i = 1; i <= MAX_BLOCKS; i++) {
              prices.push(null);
              minted.push(null);
            }
            if (!cancelled) {
              setLivePrices(prices);
              setLiveMinted(minted);
              setCollectionMeta(meta);
            }
            return;
          }
        } catch (err) {
          // if getCode failed, fall back to attempting reads but don't crash
          // eslint-disable-next-line no-console
          console.debug("Failed to verify contract code, attempting reads anyway:", err);
        }

        for (let i = 1; i <= MAX_BLOCKS; i++) {
          let blockPrice = await safeAsyncCall(() => coll.blockInfos?.(i).then(info => info?.currentPrice ?? info?.[2]));
          let blockMinted = await safeAsyncCall(() => coll.blockInfos?.(i).then(info => info?.mintCount ?? info?.[3]));

          if (blockPrice == null) {
            blockPrice = await safeAsyncCall(() => coll.getCurrentBlockPrice?.(i));
          }

          if (blockMinted == null) {
            blockMinted = await safeAsyncCall(() => coll.blockMintCounts?.(i));
          }

          prices.push(blockPrice != null ? fmtPrice(blockPrice) : null);
          minted.push(blockMinted != null ? Number(blockMinted) : null);
        }

        if (!cancelled) {
          setLivePrices(prices);
          setLiveMinted(minted);
          setCollectionMeta(meta);
          // if we reached here and previously flagged unavailable, clear the flag
          if (onchainUnavailable) setOnchainUnavailable(false);
        }
      } catch (error) {
        console.error("Failed to load collection data:", error);
          // mark unavailable to inform user
          setOnchainUnavailable(true);
        if (!cancelled) {
          setLivePrices(Array(MAX_BLOCKS).fill(null));
          setLiveMinted(Array(MAX_BLOCKS).fill(null));
          setCollectionMeta({});
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [contracts, reloadCounter]);

  React.useEffect(() => {
    const missingPrices = !Array.isArray(blockPricesProp) || blockPricesProp.length === 0;
    const missingMintCounts = !Array.isArray(blockMintCountsProp) || blockMintCountsProp.length === 0;
    if (!missingPrices && !missingMintCounts) return;
    fetchSnapshotStats().catch((err) => {
      console.debug("CollectionBlocksGrid snapshot fallback failed", err);
    });
  }, [blockPricesProp, blockMintCountsProp, fetchSnapshotStats]);

// ====== normalizace vstupů + on-chain fallbacky ======
  const normalizedNames = React.useMemo(() => {
    const source = Array.isArray(blockNames) && blockNames.length ? blockNames : DEFAULT_BLOCKS;
    const trimmed = source.slice(0, MAX_BLOCKS);
    if (trimmed.length < MAX_BLOCKS) {
      return trimmed.concat(Array(MAX_BLOCKS - trimmed.length).fill("-"));
    }
    return trimmed;
  }, [blockNames]);

  const normalizedPrices = React.useMemo(() => {
    const fromProps = Array.isArray(blockPricesProp) ? blockPricesProp.slice(0, MAX_BLOCKS) : [];
    while (fromProps.length < MAX_BLOCKS) fromProps.push(null);
    // pokud props chybí, použij livePrices
    return fromProps.map((v, i) => (v == null ? (livePrices[i] ?? fallbackPrices[i]) : v));
  }, [blockPricesProp, livePrices, fallbackPrices]);

  const normalizedMintCounts = React.useMemo(() => {
    const fromProps = Array.isArray(blockMintCountsProp) ? blockMintCountsProp.slice(0, MAX_BLOCKS) : [];
    while (fromProps.length < MAX_BLOCKS) fromProps.push(null);
    return fromProps.map((v, i) => (v == null ? (liveMinted[i] ?? fallbackMinted[i]) : v));
  }, [blockMintCountsProp, liveMinted, fallbackMinted]);

  const blockEntries = React.useMemo(
    () =>
      normalizedNames.map((name, index) => {
        const folder = safeBlockFolder(name);
        const currentPrice = normalizedPrices[index];
        const minted = normalizedMintCounts[index];
        const basePrice =
          typeof BASE_PRICES[folder] === "number" ? BASE_PRICES[folder] : null;

        return {
          id: `${folder || "BLOCK"}-${index}`,
          name,
          folder,
          currentPrice,
          minted,
          basePrice,
          diff: computeDiff(currentPrice ?? NaN, basePrice ?? NaN),
          thumb: getBlockThumb(name),
          hasData: Boolean(name && name !== "-"),
          buttonStyle: resolveButtonStyle(name),
        };
      }),
    [normalizedNames, normalizedPrices, normalizedMintCounts]
  );

  const stats = React.useMemo(() => {
    const priceEntries = normalizedPrices
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => Number.isFinite(value));

    const mintEntries = normalizedMintCounts
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => Number.isFinite(value));

    const totalMinted = mintEntries.reduce((acc, { value }) => acc + value, 0);

    const averagePrice = priceEntries.length
      ? Math.round(priceEntries.reduce((acc, { value }) => acc + value, 0) / priceEntries.length)
      : null;

    const highestPrice = priceEntries.reduce((acc, e) => (acc && acc.value > e.value ? acc : e), null);
    const lowestPrice = priceEntries.reduce((acc, e) => (acc && acc.value < e.value ? acc : e), null);
    const topMinted = mintEntries.reduce((acc, e) => (acc && acc.value > e.value ? acc : e), null);

    return {
      totalMinted,
      averagePrice,
      highestPrice,
      lowestPrice,
      topMinted,
      blocksWithData: blockEntries.filter((entry) => entry.hasData).length,
    };
  }, [normalizedPrices, normalizedMintCounts, blockEntries]);

  const selectedEntry = React.useMemo(() => {
    const idx = Number(selectedBlock) - 1;
    return blockEntries[idx] || blockEntries[0] || null;
  }, [selectedBlock, blockEntries]);

  const collectionTotals = React.useMemo(
    () => ({
      maxSupply: collectionMeta.maxSupply ?? null,
      maxTickets: collectionMeta.maxTickets ?? null,
      ticketMinted: collectionMeta.ticketMinted ?? null,
      biggiMinted: collectionMeta.biggiMinted ?? null,
      paused: Boolean(collectionMeta.paused),
    }),
    [collectionMeta]
  );

  React.useEffect(() => { if (openBlock) setHoveredBlock(null); }, [openBlock]);
  React.useEffect(() => {
    if (!openBlock) return;
    if (typeof document === "undefined") return;
    const body = document.body;
    if (!body) return;

    const prevTouchAction = body.style.touchAction;
    body.style.touchAction = "none";

    return () => {
      body.style.touchAction = prevTouchAction;
    };
  }, [openBlock]);

  const closeModal = React.useCallback(() => setOpenBlock(null), []);

  const handleCardOpen = React.useCallback((name) => {
    if (name && name !== "-") setOpenBlock(name);
  }, []);

  const handleCardKeyDown = React.useCallback((e, name) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardOpen(name);
    }
  }, [handleCardOpen]);

  const handleRowHoverEnter = React.useCallback((name) => {
    setHoveredBlock(name);
  }, []);

  const handleRowHoverLeave = React.useCallback(() => {
    setHoveredBlock(null);
  }, []);

  const modalRows = openBlock ? ROWS_BY_BLOCK[safeBlockFolder(openBlock)] || MAX_BLOCKS : MAX_BLOCKS;
  const modalImages = React.useMemo(() => (openBlock ? getBlockImages(openBlock) : []), [openBlock]);

  const highestPriceName =
    stats.highestPrice && blockEntries[stats.highestPrice.index] && blockEntries[stats.highestPrice.index].name;
  const lowestPriceName =
    stats.lowestPrice && blockEntries[stats.lowestPrice.index] && blockEntries[stats.lowestPrice.index].name;
  const topMintedName =
    stats.topMinted && blockEntries[stats.topMinted.index] && blockEntries[stats.topMinted.index].name;

  const infoConcepts = [
    { concept: "Blocks", explanation: "Each block groups NFTs by eye colour. Tap a card to open the full preview." },
    { concept: "Base vs live price", explanation: "Base price is a reference. Live price comes from the contract." },
    { concept: "Minted", explanation: "Live on-chain minted count per block." },
    { concept: "Rows per block", explanation: "Different blocks use different preview grid rows." },
    { concept: "Previews", explanation: "Images loaded from /images/blocks/<BLOCK>/." },
  ];

  const infoTableRows = blockEntries
    .filter((entry) => entry.hasData)
    .map((entry) => ({
      block: entry.name,
      price: formatPrice(entry.currentPrice),
      minted: formatCount(entry.minted),
      base: Number.isFinite(entry.basePrice) ? `${Math.round(entry.basePrice)} POL` : FALLBACK_VALUE,
    }));

  const statRows = [
    { label: "Blocks configured", value: String(stats.blocksWithData ?? FALLBACK_VALUE), detail: "Cards rendered below" },
    { label: "Total minted", value: Number.isFinite(stats.totalMinted) ? String(Math.round(stats.totalMinted)) : FALLBACK_VALUE, detail: "Sum across all blocks" },
    { label: "Average price", value: Number.isFinite(stats.averagePrice) ? `${stats.averagePrice} POL` : FALLBACK_VALUE, detail: "Based on live prices" },
    { label: "Highest price", value: stats.highestPrice && Number.isFinite(stats.highestPrice.value) ? `${Math.round(stats.highestPrice.value)} POL` : FALLBACK_VALUE, detail: highestPriceName || FALLBACK_VALUE },
    { label: "Lowest price", value: stats.lowestPrice && Number.isFinite(stats.lowestPrice.value) ? `${Math.round(stats.lowestPrice.value)} POL` : FALLBACK_VALUE, detail: lowestPriceName || FALLBACK_VALUE },
    { label: "Top minted block", value: stats.topMinted && Number.isFinite(stats.topMinted.value) ? String(Math.round(stats.topMinted.value)) : FALLBACK_VALUE, detail: topMintedName || FALLBACK_VALUE },
  ];

  // --- nový lokální stav pro fallback řízení activeCollection ---
  const [localActive, setLocalActive] = React.useState(activeCollectionProp);
  React.useEffect(() => {
    setLocalActive(activeCollectionProp);
  }, [activeCollectionProp]);

  // effectiveActive: pokud rodič prop zadá a aktualizuje, bude použit; jinak lokalní fallback
  const effectiveActive = typeof activeCollectionProp === "string" ? localActive : localActive;

  const handleSwitchCollection = (key) => {
    // aktualizuj lokálně (zajistí zobrazení i když parent nekontroluje)
    // add a console trace to help debug UI hiding issues
    try {
      // set local active first
      setLocalActive(key);
      // call parent's handler if provided
      if (typeof onCollectionChange === 'function') onCollectionChange(key);
    } catch (e) {
      // log error so it doesn't silently swallow and hide the UI
      // eslint-disable-next-line no-console
      console.error('[CollectionBlocksGrid] handleSwitchCollection error:', e);
    }
  };

  const handleEnsureAmoy = React.useCallback(async () => {
    try {
      await ensureAmoy();
      // try reload data after switching
      setOnchainUnavailable(false);
      setReloadCounter((c) => c + 1);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("ensureAmoy failed:", err);
    }
  }, []);

  const handleRetry = React.useCallback(() => {
    setReloadCounter((c) => c + 1);
  }, []);

  const renderBlockCardsGrid = React.useCallback(
    (ctaLabel = "Open preview") =>
      blockEntries
        .filter((e) => e.hasData)
        .map((entry) => (
          <BlockCard
            key={entry.id}
            entry={entry}
            isHovered={hoveredBlock === entry.name}
            isTouch={isTouch}
            onOpen={handleCardOpen}
            onKeyDown={handleCardKeyDown}
            onMouseEnter={handleRowHoverEnter}
            onMouseLeave={handleRowHoverLeave}
            ctaLabel={ctaLabel}
          />
        )),
    [blockEntries, hoveredBlock, isTouch, handleCardOpen, handleCardKeyDown, handleRowHoverEnter, handleRowHoverLeave]
  );

  const renderCollectionTwo = React.useCallback(() => (
    <Collection2Panel 
      renderBlockCardsGrid={renderBlockCardsGrid}
      blockEntries={blockEntries}
      selectedBlock={selectedBlock}
      selectedBackground={selectedBackground}
      desiredTokenId={desiredTokenId}
      selectedEntry={selectedEntry}
      collectionTotals={collectionTotals}
      onBlockChange={setSelectedBlock}
      onBackgroundChange={setSelectedBackground}
      onTokenIdChange={setDesiredTokenId}
    />
  ), [renderBlockCardsGrid, blockEntries, selectedBlock, selectedBackground, desiredTokenId, selectedEntry, collectionTotals]);

const renderExpansionPanel = () => (
    <section className="collection-grid__panel">
      <header className="collection-grid__panel-header">
        <h3>Expansion overview</h3>
        <p>Protocol telemetry moved into the collection hub.</p>
      </header>

      <div className="collection-grid__expansion-loading">
        <React.Suspense
          fallback={
            <div className="collection-grid__expansion-loading">
              Loading expansion data...
            </div>
          }
        >
          <ExpansionPanelLazy compact={isMobile} />
        </React.Suspense>
      </div>
    </section>
  );

  const renderCollectionOne = React.useCallback(() => (
    <Collection1Panel 
      renderBlockCardsGrid={renderBlockCardsGrid}
      blockEntries={blockEntries}
      blockPrices={normalizedPrices}
      blockMints={normalizedMintCounts}
      stats={stats}
      highestPriceName={highestPriceName}
      lowestPriceName={lowestPriceName}
      topMintedName={topMintedName}
      additionalText={additionalText}
    />
  ), [renderBlockCardsGrid, blockEntries, normalizedPrices, normalizedMintCounts, stats, highestPriceName, lowestPriceName, topMintedName, additionalText]);

  const activePanel =
    effectiveActive === "collection2"
      ? renderCollectionTwo()
      : effectiveActive === "expansion"
        ? renderExpansionPanel()
        : renderCollectionOne();

  return (
    <section className="collection-grid">
      <div className={`collection-grid__surface${isMobile ? " is-mobile" : ""}`}>
        <header className="collection-grid__header panel-header panel-header--collection">
          <div>
            <h2 className="collection-grid__title">Biggi Collection</h2>
            <p className="collection-grid__subtitle">Collections hub - live on-chain stats</p>
          </div>

          <div className="collection-grid__header-actions collection-grid__header-actions-gap">
            <div className="collection-grid__tabs">
              <button
                type="button"
                className={`collection-grid__tab${effectiveActive === "collection1" ? " is-active" : ""}`}
                onClick={() => handleSwitchCollection("collection1")}
              >
                Collection 1
              </button>
              <button
                type="button"
                className={`collection-grid__tab${effectiveActive === "collection2" ? " is-active" : ""}`}
                onClick={() => handleSwitchCollection("collection2")}
              >
                Collection 2
              </button>
              <button
                type="button"
                className={`collection-grid__tab${effectiveActive === "expansion" ? " is-active" : ""}`}
                onClick={() => handleSwitchCollection("expansion")}
              >
                Expansion
              </button>
              <button
                type="button"
                className="collection-grid__tab collection-grid__tab--future"
                onClick={() => setFutureOpen(true)}
              >
                Future Collections
              </button>
              <button
                type="button"
                className={`collection-grid__info-toggle${infoOpen ? " is-active" : ""}`}
                onClick={() => setInfoOpen((v) => !v)}
                onMouseEnter={(e) => { if (!isTouch && !infoOpen) e.currentTarget.classList.add("is-hovered"); }}
                onMouseLeave={(e) => e.currentTarget.classList.remove("is-hovered")}
                aria-expanded={infoOpen}
                aria-controls="collection-info-panel"
              >
                Info
              </button>
            </div>
          </div>
        </header>

        {infoOpen && (
          <InfoPanel
            isOpen={infoOpen}
            onClose={() => setInfoOpen(false)}
            blockEntries={blockEntries}
            formatPrice={formatPrice}
            formatCount={formatCount}
          />
        )}

        {onchainUnavailable && (
          <div className="collection-grid__onchain-warning" role="status" aria-live="polite">
              <div className="collection-grid__onchain-message">On-chain data is unavailable. Switch MetaMask to <strong>Polygon Amoy</strong> or try again.</div>
              <div className="collection-grid__onchain-actions">
                <button type="button" className="collection-grid__btn" onClick={handleEnsureAmoy} aria-label="Switch MetaMask to Polygon Amoy">Switch to Amoy</button>
                <button type="button" className="collection-grid__btn collection-grid__btn--ghost" onClick={handleRetry} aria-label="Retry loading on-chain data">Try again</button>
              </div>
          </div>
        )}

        {futureOpen && (
          <FutureCollectionsModal 
            isOpen={futureOpen}
            onClose={() => setFutureOpen(false)}
            futureStats={futureStats}
          />
        )}

        {activePanel || (
          <section className="collection-grid__panel">
            <div className="collection-grid__panel-empty">
              <p>Unable to render the selected panel. If this persists, check console for details.</p>
            </div>
          </section>
        )}
      </div>

      {openBlock && (
        <ModalPortal lockScroll>
          <div
            className="collection-grid__modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${safeBlockFolder(openBlock)} block preview`}
          >
            <div className="collection-grid__modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="collection-grid__modal-header">
                <h3>{safeBlockFolder(openBlock)} block preview</h3>
                <button type="button" className="collection-grid__close-btn" onClick={closeModal}>
                  Close
                </button>
              </div>

              <div className="collection-grid__modal-grid" style={{ "--grid-rows": String(modalRows) }}>
                {modalImages.length > 0 ? (
                  modalImages.map((file, index) => {
                    const isColumnStart = index % modalRows === 0;
                    const columnNumber = Math.floor(index / modalRows) + 1;
                    const imagePath = buildBlockImagePath(file);
                    return (
                      <div key={`${file}-${index}`} className="collection-grid__modal-item">
                        {isColumnStart && !isMobile && (
                          <div className="collection-grid__badge">
                            ID {safeBlockFolder(openBlock)} #{columnNumber}
                          </div>
                        )}
                        <img
                          src={imagePath}
                          alt={`${safeBlockFolder(openBlock)} NFT ${index + 1}`}
                          width={PREVIEW_SIZE}
                          height={PREVIEW_SIZE}
                          loading="React.lazy"
                          decoding="async"
                          onError={handleImageError}
                        />
                        <span className="collection-grid__modal-name">{file.replace(/\.\w+$/, "")}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="collection-grid__modal-empty">No images configured for this block.</div>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </section>
  );
}

export default CollectionBlocksGrid;











