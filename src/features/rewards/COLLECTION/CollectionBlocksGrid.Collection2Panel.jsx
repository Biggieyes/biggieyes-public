import * as React from "react";
import { FALLBACK_VALUE } from "./COLLECTIONBlocksGrid.constants";
import {
  expectedPublicBlockForIndex,
  formatCount,
  formatPrice,
  isPublicNftInfoConsistent,
  PUBLIC_MINT_BUSY_STATES,
} from "./COLLECTIONBlocksGrid.utils";
import { handleImageError } from "../../../utils/images";

const PUBLIC_MAX_SUPPLY = 100;
const POLYGON_CHAIN_ID = 137;

const SectionHeader = ({ label, accent = "#ffe800" }) => (
  <div
    className="collection-grid__section-header"
    style={{ "--section-accent": accent }}
  >
    <span className="collection-grid__section-title">{label}</span>
    <span className="collection-grid__section-line" />
  </div>
);

const percent = (value, maximum) => {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, (value / maximum) * 100));
};

const shortAccount = (account) => {
  const normalized = String(account || "");
  if (normalized.length < 12) return normalized || "Not connected";
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
};

const resolveMintStatus = ({
  totals,
  info,
  loading,
  error,
  hasSelection,
  infoConsistent,
  artwork,
  price,
}) => {
  if (totals?.paused == null) {
    return {
      label: "Checking contract",
      tone: "neutral",
      hint: "Reading the current Polygon state.",
    };
  }
  if (Number(totals.maxSupply) !== PUBLIC_MAX_SUPPLY) {
    return {
      label: "Supply mismatch",
      tone: "warn",
      hint: "Mint is blocked until the contract reports exactly 100 NFTs.",
    };
  }
  if (totals.paused) {
    return {
      label: "Mint paused",
      tone: "warn",
      hint: "The collection is prepared, but primary minting is not open yet.",
    };
  }
  if (!totals.chapterActive) {
    return {
      label: "Chapter inactive",
      tone: "warn",
      hint: "Only the active CORE chapter can be minted.",
    };
  }
  if (
    !totals.metadataFullyConfigured ||
    totals.rewardMatrixConsistent !== true
  ) {
    return {
      label: "Metadata incomplete",
      tone: "warn",
      hint: "The complete 10 x 10 metadata matrix is required before minting.",
    };
  }
  if (!totals.publicUnlocked) {
    return {
      label: "Public mint locked",
      tone: "warn",
      hint: "Public mint opens only after this chapter's ticket phase is complete.",
    };
  }
  if (!hasSelection) {
    return {
      label: "Select an NFT",
      tone: "neutral",
      hint: "Choose a block and one of its ten NFT numbers.",
    };
  }
  if (loading) {
    return {
      label: "Checking NFT",
      tone: "neutral",
      hint: "Confirming this NFT directly on Polygon.",
    };
  }
  if (error || !infoConsistent) {
    return {
      label: "Metadata mismatch",
      tone: "warn",
      hint:
        error || "This NFT does not match the fixed public metadata matrix.",
    };
  }
  if (info.minted) {
    return {
      label: "Already minted",
      tone: "warn",
      hint: "Select another NFT number from this or another block.",
    };
  }
  if (artwork?.loading) {
    return {
      label: "Checking artwork",
      tone: "neutral",
      hint: "Reading the selected NFT's Public metadata from IPFS.",
    };
  }
  if (artwork?.error || !artwork?.valid) {
    return {
      label: "Artwork unavailable",
      tone: "warn",
      hint:
        artwork?.error ||
        "The selected NFT's Public artwork metadata could not be verified.",
    };
  }
  if (artwork.finalized !== true) {
    return {
      label: "Artwork pending",
      tone: "warn",
      hint: "This NFT still uses the prereveal placeholder. Mint opens after the final image is published.",
    };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return {
      label: "Price unavailable",
      tone: "warn",
      hint: "The current block price could not be verified. Refresh before minting.",
    };
  }
  return {
    label: "Available",
    tone: "ok",
    hint: "The final live price is checked again before the wallet opens.",
  };
};

const resolveActionLabel = ({
  canMint,
  mintStatus,
  mintState,
  walletAccount,
  walletChainId,
  selectedIndex,
  selectedPrice,
}) => {
  switch (mintState?.status) {
    case "connecting":
      return "Connecting wallet...";
    case "switching":
      return "Switching to Polygon...";
    case "preparing":
      return "Checking live price...";
    case "signature":
      return "Confirm in wallet";
    case "pending":
      return "Mint transaction pending...";
    case "success":
      return `NFT #${mintState.index ?? selectedIndex} minted`;
    case "unconfirmed":
      return "Check transaction status";
    default:
      break;
  }

  if (!canMint) return mintStatus.label;
  if (!walletAccount) return "Connect wallet to mint";
  if (Number(walletChainId) !== POLYGON_CHAIN_ID) return "Switch to Polygon";
  return `Mint NFT #${selectedIndex} for ${formatPrice(selectedPrice)}`;
};

const COLLECTION2Panel = React.memo(
  ({
    blockEntries,
    desiredTokenId,
    selectedBlock,
    selectedNftInfo,
    selectedNftLoading,
    selectedNftError,
    selectedArtwork,
    COLLECTIONTotals,
    onTokenIdChange,
    onBlockSelect,
    onMint,
    walletAccount,
    walletChainId,
    walletConnecting = false,
    mintState,
    renderChapterSwitcher,
    comingSoon = false,
  }) => {
    const maxSupply = Number(COLLECTIONTotals?.maxSupply) || PUBLIC_MAX_SUPPLY;
    const selectedIndex = Number(desiredTokenId);
    const hasSelection =
      Number.isSafeInteger(selectedIndex) &&
      selectedIndex >= 1 &&
      selectedIndex <= maxSupply;
    const expectedBlock = expectedPublicBlockForIndex(selectedIndex);
    const selectedBlockNumber =
      expectedBlock ||
      (Number.isInteger(Number(selectedBlock)) ? Number(selectedBlock) : 1);
    const selectedEntry = blockEntries?.[selectedBlockNumber - 1] || null;
    const selectedBlockName = selectedEntry?.name || FALLBACK_VALUE;
    const selectedBlockPrice = Number.isFinite(selectedEntry?.currentPrice)
      ? selectedEntry.currentPrice
      : null;
    const infoConsistent = isPublicNftInfoConsistent(
      selectedIndex,
      selectedNftInfo,
    );
    const mintedPct = percent(
      COLLECTIONTotals?.biggiMinted,
      COLLECTIONTotals?.maxSupply,
    );
    const metadataPct = percent(
      COLLECTIONTotals?.metadataConfiguredCount,
      COLLECTIONTotals?.maxSupply,
    );
    const mintStatus = comingSoon
      ? {
          label: "Coming soon",
          tone: "neutral",
          hint: "This chapter is not active yet.",
        }
      : resolveMintStatus({
          totals: COLLECTIONTotals,
          info: selectedNftInfo,
          loading: selectedNftLoading,
          error: selectedNftError,
          hasSelection,
          infoConsistent,
          artwork: selectedArtwork,
          price: selectedBlockPrice,
        });
    const canMint =
      !comingSoon &&
      mintStatus.tone === "ok" &&
      mintStatus.label === "Available";
    const busy =
      walletConnecting || PUBLIC_MINT_BUSY_STATES.has(mintState?.status);
    const actionLabel = resolveActionLabel({
      canMint,
      mintStatus,
      mintState,
      walletAccount,
      walletChainId,
      selectedIndex,
      selectedPrice: selectedBlockPrice,
    });
    const checkingSubmitted =
      mintState?.status === "unconfirmed" && Boolean(mintState.txHash);
    const actionDisabled =
      (!canMint && !checkingSubmitted) ||
      busy ||
      mintState?.status === "success";
    const rangeStart = (selectedBlockNumber - 1) * 10 + 1;
    const rangeEnd = Math.min(rangeStart + 9, maxSupply);
    const tokenOptions = Array.from(
      { length: Math.max(0, rangeEnd - rangeStart + 1) },
      (_, index) => rangeStart + index,
    );
    const selectedImage =
      hasSelection && selectedArtwork?.valid ? selectedArtwork.imageUrl : "";
    const artworkState = selectedArtwork?.loading
      ? "Loading..."
      : selectedArtwork?.valid
        ? selectedArtwork.finalized
          ? "Final"
          : "Prereveal placeholder"
        : FALLBACK_VALUE;
    const previewLabel = selectedArtwork?.loading
      ? "Loading artwork"
      : selectedArtwork?.finalized
        ? "Final artwork"
        : "Artwork pending";

    if (!blockEntries || blockEntries.length === 0) {
      return (
        <div className="collection-grid__panel-empty">Loading blocks...</div>
      );
    }

    return (
      <section className="collection-grid__panel collection-grid__panel--glass collection-public">
        <SectionHeader label="Public primary mint" accent="#5ddcff" />
        {renderChapterSwitcher?.()}

        <ol className="collection-public__steps" aria-label="Public mint steps">
          <li>
            <span>1</span>
            <strong>Choose block</strong>
          </li>
          <li>
            <span>2</span>
            <strong>Choose exact NFT</strong>
          </li>
          <li>
            <span>3</span>
            <strong>Confirm POL mint</strong>
          </li>
        </ol>

        <div
          className="collection-public__mechanism"
          aria-label="Mint mechanism"
        >
          <span>100 fixed NFTs</span>
          <span>10 NFTs per block</span>
          <span>No background choice</span>
          <span>Live Originals block price</span>
        </div>

        <SectionHeader label="1. Choose a block" accent="#5ddcff" />
        <div
          className="collection-public__block-picker"
          role="group"
          aria-label="Choose block"
        >
          {blockEntries.map((entry, index) => {
            const blockNumber = index + 1;
            const firstNft = index * 10 + 1;
            const lastNft = Math.min(firstNft + 9, maxSupply);
            const active = selectedBlockNumber === blockNumber;
            return (
              <button
                type="button"
                className={`collection-public__block-button${active ? " is-active" : ""}`}
                key={entry.id || blockNumber}
                onClick={() => onBlockSelect(blockNumber)}
                aria-pressed={active}
                disabled={comingSoon || busy}
              >
                <span>{entry.name}</span>
                <strong>{formatPrice(entry.currentPrice)}</strong>
                <small>
                  #{firstNft}-#{lastNft} | {formatCount(entry.minted)} / 10
                  minted
                </small>
              </button>
            );
          })}
        </div>

        <div className="collection-public__mint-layout">
          <div className="collection-public__selector">
            <div className="collection-grid__cardbox-head">
              <h3>2. Choose exact NFT</h3>
              <span className="collection-grid__pill collection-grid__pill--outline">
                {selectedBlockName}
              </span>
            </div>
            <div
              className="collection-public__token-picker"
              role="group"
              aria-label={`${selectedBlockName} NFT numbers`}
            >
              {tokenOptions.map((tokenIndex) => {
                const selected = tokenIndex === selectedIndex;
                const minted = selected && selectedNftInfo?.minted;
                return (
                  <button
                    type="button"
                    key={tokenIndex}
                    className={`collection-public__token-button${selected ? " is-active" : ""}${minted ? " is-minted" : ""}`}
                    onClick={() => onTokenIdChange(String(tokenIndex))}
                    aria-pressed={selected}
                    disabled={comingSoon || busy}
                    title={
                      minted
                        ? `NFT #${tokenIndex} is already minted`
                        : `Select NFT #${tokenIndex}`
                    }
                  >
                    #{tokenIndex}
                  </button>
                );
              })}
            </div>
            <p className="collection-grid__helper">
              Every number has one fixed artwork. There are no selectable
              background variants or background price bonuses.
            </p>
          </div>

          <article className="collection-public__checkout">
            <div className="collection-public__preview">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={
                    selectedArtwork?.name ||
                    `Public NFT #${selectedIndex}, ${selectedBlockName}`
                  }
                  onError={handleImageError}
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <span>Select an NFT</span>
              )}
              <span className="collection-public__preview-label">
                {previewLabel}
              </span>
            </div>

            <div className="collection-public__checkout-content">
              <div className="collection-grid__cardbox-head">
                <div>
                  <span className="collection-public__eyebrow">
                    Primary mint
                  </span>
                  <h3>
                    {hasSelection ? `NFT #${selectedIndex}` : "Select NFT"}
                  </h3>
                </div>
                <span
                  className={`collection-grid__pill collection-grid__pill--${mintStatus.tone}`}
                >
                  {mintStatus.label}
                </span>
              </div>

              <dl className="collection-grid__key-values">
                <div>
                  <dt>Block</dt>
                  <dd>{selectedBlockName}</dd>
                </div>
                <div>
                  <dt>Live price</dt>
                  <dd className="collection-grid__price-live">
                    {formatPrice(selectedBlockPrice)}
                  </dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>POL</dd>
                </div>
                <div>
                  <dt>Artwork</dt>
                  <dd>{artworkState}</dd>
                </div>
                <div>
                  <dt>Wallet</dt>
                  <dd title={walletAccount || undefined}>
                    {shortAccount(walletAccount)}
                  </dd>
                </div>
              </dl>

              <p className={`collection-public__status is-${mintStatus.tone}`}>
                {mintStatus.hint}
              </p>

              <button
                type="button"
                className="collection-grid__action-btn collection-grid__action-btn--primary collection-public__mint-button"
                onClick={() => onMint(selectedIndex)}
                disabled={actionDisabled}
              >
                {actionLabel}
              </button>

              {mintState?.message ? (
                <div
                  className={`collection-public__transaction is-${mintState.status}`}
                  role={mintState.status === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  <span>{mintState.message}</span>
                  {mintState.txHash ? (
                    <a
                      href={`https://polygonscan.com/tx/${mintState.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View transaction
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        </div>

        <div className="collection-grid__stat-cards collection-grid__stat-cards--wide">
          <article className="collection-grid__stat-card collection-grid__stat-card--glass">
            <span className="muted">Public NFTs minted</span>
            <strong className="collection-grid__stat-value-large">
              {comingSoon
                ? "SOON"
                : `${formatCount(COLLECTIONTotals?.biggiMinted)} / ${formatCount(COLLECTIONTotals?.maxSupply)}`}
            </strong>
            <div className="collection-grid__progress">
              <span
                className="collection-grid__progress-bar"
                style={{ width: `${comingSoon ? 0 : (mintedPct ?? 0)}%` }}
              />
            </div>
          </article>
          <article className="collection-grid__stat-card collection-grid__stat-card--glass">
            <span className="muted">Metadata configured</span>
            <strong className="collection-grid__stat-value-large">
              {comingSoon
                ? "SOON"
                : `${formatCount(COLLECTIONTotals?.metadataConfiguredCount)} / ${formatCount(COLLECTIONTotals?.maxSupply)}`}
            </strong>
            <div className="collection-grid__progress">
              <span
                className="collection-grid__progress-bar"
                style={{ width: `${comingSoon ? 0 : (metadataPct ?? 0)}%` }}
              />
            </div>
            <span className="collection-grid__stat-foot">
              {comingSoon
                ? "Future chapter"
                : selectedArtwork?.valid
                  ? selectedArtwork.finalized
                    ? "Selected artwork finalized"
                    : "Selected artwork in prereveal"
                  : "Artwork verification pending"}
            </span>
          </article>
          <article className="collection-grid__stat-card collection-grid__stat-card--glass">
            <span className="muted">Public gate</span>
            <strong className="collection-grid__stat-value-large">
              {comingSoon
                ? "SOON"
                : COLLECTIONTotals?.publicUnlocked
                  ? "Unlocked"
                  : "Locked"}
            </strong>
            <span className="collection-grid__stat-foot">
              {comingSoon ? "Future chapter" : "Polygon mainnet"}
            </span>
          </article>
        </div>
      </section>
    );
  },
);

COLLECTION2Panel.displayName = "COLLECTION2Panel";

export default COLLECTION2Panel;
