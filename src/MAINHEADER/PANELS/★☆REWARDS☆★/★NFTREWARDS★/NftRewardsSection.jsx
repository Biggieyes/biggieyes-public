import * as React from "react";
import { addBase, handleImageError } from "../../../../utils/images.ts";

const FALLBACK_RANGE = Array.from({ length: 10 }, (_, idx) => idx + 1);
const FALLBACK_URI_LABEL = "not set";
const FALLBACK_ADDRESS = "—";

const ensureRanks = (ranks, factory) => {
  const base =
    typeof factory === "function"
      ? factory()
      : { 1: false, 2: false, 3: false };
  if (!ranks) return base;
  return {
    ...base,
    ...ranks,
  };
};

const renderStaticPreview = (basePath, count, prefix) => {
  const safeCount = Math.max(0, Number(count) || 0);
  if (!safeCount) return null;
  return (
    <div className="rewards-grid__preview-grid">
      {Array.from({ length: safeCount }).map((_, index) => {
        const src = addBase(`${basePath}/${index + 1}.png`);
        return (
          <div
            key={`${prefix}-${index}`}
            className="rewards-grid__preview-thumb"
          >
            <img
              src={src}
              alt={`${prefix} reward ${index + 1}`}
              width={70}
              height={70}
              loading="React.lazy"
              decoding="async"
              onError={handleImageError}
            />
            <span className="rewards-grid__preview-caption">
              NFT #{index + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
};

function NftRewardsSection({
  data,
  range = FALLBACK_RANGE,
  formatInteger,
  formatAddress,
  formatUriDisplay,
  onOpenExplorer,
  characterCount = 10,
  mysteryCount = 10,
  emptyRanks,
}) {
  const {
    baseURIs = {},
    characterClaimed = {},
    leaderboardClaimed = {},
    mysteryClaimed = {},
    totalMinted = 0,
    contractAddress = null,
  } = data || {};

  const normalizedRange =
    Array.isArray(range) && range.length ? range : FALLBACK_RANGE;
  const mintedLabel =
    typeof formatInteger === "function"
      ? formatInteger(totalMinted)
      : String(totalMinted ?? 0);
  const formattedAddress =
    typeof formatAddress === "function"
      ? formatAddress(contractAddress)
      : contractAddress || FALLBACK_ADDRESS;
  const characterUri =
    typeof formatUriDisplay === "function"
      ? formatUriDisplay(baseURIs.character)
      : baseURIs.character || FALLBACK_URI_LABEL;
  const leaderboardUri =
    typeof formatUriDisplay === "function"
      ? formatUriDisplay(baseURIs.leaderboard)
      : baseURIs.leaderboard || FALLBACK_URI_LABEL;
  const mysteryUri =
    typeof formatUriDisplay === "function"
      ? formatUriDisplay(baseURIs.mystery)
      : baseURIs.mystery || FALLBACK_URI_LABEL;
  const explorerDisabled = !contractAddress;
  const countTruthy = (obj) => Object.values(obj || {}).filter(Boolean).length;
  const mintedCharacters = countTruthy(characterClaimed);
  const mintedLeaderboard = Object.values(leaderboardClaimed || {}).reduce(
    (acc, ranks) => acc + countTruthy(ranks),
    0,
  );
  const mintedMystery = countTruthy(mysteryClaimed);

  const tableRows = normalizedRange.map((block) => {
    const charClaimed = Boolean(characterClaimed?.[block]);
    const lbCount = countTruthy(leaderboardClaimed?.[block]);
    const mysClaimed = Boolean(mysteryClaimed?.[block]);
    return {
      block,
      character: charClaimed ? "Minted" : "Open",
      characterTone: charClaimed ? "is-claimed" : "is-open",
      leaderboard: `${lbCount}/3 minted`,
      leaderboardTone:
        lbCount === 3 ? "is-claimed" : lbCount > 0 ? "is-open" : "",
      mystery: mysClaimed ? "Minted" : "Open",
      mysteryTone: mysClaimed ? "is-claimed" : "is-open",
    };
  });

  return (
    <section className="rewards-panel__section rewards-panel__section--nft nft-rewards">
      <div className="nft-rewards__container">
        <div className="rewards-panel__grid">
          <div className="nft-rewards__summary-card biggi-card biggi-card--y rewards-panel__card">
            <div className="biggi-card__glow" aria-hidden />
            <div className="biggi-card__body">
              <span className="nft-rewards__summary-label">Total minted</span>
              <span className="nft-rewards__summary-value">{mintedLabel}</span>
              <span className="nft-rewards__summary-hint">
                Character + Leaderboard + Mystery drops
              </span>
            </div>
          </div>
          <div className="nft-rewards__summary-card biggi-card biggi-card--c rewards-panel__card">
            <div className="biggi-card__glow" aria-hidden />
            <div className="biggi-card__body">
              <span className="nft-rewards__summary-label">
                Rewards contract
              </span>
              <span className="nft-rewards__summary-value">
                {formattedAddress}
              </span>
              <span className="nft-rewards__summary-hint">
                Polygon Amoy deployment
              </span>
              <button
                type="button"
                className="nft-rewards__summary-btn biggi-btn biggi-btn--ghost"
                onClick={() =>
                  !explorerDisabled &&
                  typeof onOpenExplorer === "function" &&
                  onOpenExplorer(contractAddress)
                }
                disabled={explorerDisabled}
              >
                View on explorer
              </button>
            </div>
          </div>
        </div>

        <div className="nft-rewards__stat-grid">
          <div className="nft-rewards__stat">
            <span className="label">Characters minted</span>
            <span className="value">{mintedCharacters}</span>
          </div>
          <div className="nft-rewards__stat">
            <span className="label">Leaderboard NFTs</span>
            <span className="value">{mintedLeaderboard}</span>
          </div>
          <div className="nft-rewards__stat">
            <span className="label">Mystery minted</span>
            <span className="value">{mintedMystery}</span>
          </div>
        </div>

        <div className="nft-rewards__uris">
          <div>
            <span className="nft-rewards__uri-label">Character base URI</span>
            <code className="nft-rewards__uri-value">{characterUri}</code>
          </div>
          <div>
            <span className="nft-rewards__uri-label">Leaderboard base URI</span>
            <code className="nft-rewards__uri-value">{leaderboardUri}</code>
          </div>
          <div>
            <span className="nft-rewards__uri-label">Mystery base URI</span>
            <code className="nft-rewards__uri-value">{mysteryUri}</code>
          </div>
        </div>

        <div className="rewards-panel__grid nft-rewards__cards">
          <article className="biggi-card biggi-card--v rewards-panel__card nft-rewards__card">
            <div className="biggi-card__glow" aria-hidden />
            <div className="biggi-card__header">
              <div className="biggi-card__heading">
                <h3>NFT Characters</h3>
                <p>
                  One Character reward per block after requirements are met.
                </p>
              </div>
              <span className="biggi-accent-chip">
                <span className="label">Minted</span>
                <span className="value">{mintedLabel}</span>
              </span>
            </div>

            <div className="biggi-card__body">
              {renderStaticPreview(
                "/images/rewards/characters",
                characterCount,
                "Character",
              )}

              <div className="nft-rewards__status-list">
                {normalizedRange.map((block) => {
                  const claimed = Boolean(characterClaimed?.[block]);
                  return (
                    <div
                      key={`char-${block}`}
                      className="nft-rewards__status-row"
                    >
                      <div className="nft-rewards__status-meta">
                        <span>Block {block}</span>
                        <small>1 Character NFT</small>
                      </div>
                      <span
                        className={`nft-rewards__status-pill ${claimed ? "is-claimed" : "is-open"}`}
                      >
                        {claimed ? "Minted" : "Awaiting mint"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <ul className="rewards-grid__info-list">
                <li>Mint controlled by the core admin contract.</li>
                <li>
                  Players unlock Character drops by completing all ten
                  backgrounds.
                </li>
              </ul>
            </div>
          </article>

          <article className="biggi-card biggi-card--c rewards-panel__card nft-rewards__card">
            <div className="biggi-card__glow" aria-hidden />
            <div className="biggi-card__header">
              <div className="biggi-card__heading">
                <h3>Leaderboard NFTs</h3>
                <p>Top three wallets per block earn a commemorative NFT.</p>
              </div>
            </div>

            <div className="biggi-card__body">
              <div className="nft-rewards__leaderboard-grid">
                {normalizedRange.map((block) => {
                  const ranks = ensureRanks(
                    leaderboardClaimed?.[block],
                    emptyRanks,
                  );
                  return (
                    <div
                      key={`lb-${block}`}
                      className="nft-rewards__leaderboard-row"
                    >
                      <span className="nft-rewards__status-label">
                        Block {block}
                      </span>
                      <div className="nft-rewards__badge-set">
                        {[1, 2, 3].map((rank) => (
                          <span
                            key={`${block}-${rank}`}
                            className={`nft-rewards__badge ${ranks?.[rank] ? "is-claimed" : ""}`}
                          >
                            #{rank}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <ul className="rewards-grid__info-list">
                <li>Maximum of 30 leaderboard NFTs across all ranks.</li>
                <li>Mint is executed manually after on-chain validation.</li>
              </ul>
            </div>
          </article>

          <article className="biggi-card biggi-card--y rewards-panel__card nft-rewards__card">
            <div className="biggi-card__glow" aria-hidden />
            <div className="biggi-card__header">
              <div className="biggi-card__heading">
                <h3>Mystery NFTs</h3>
                <p>Special drop unlocked once each block is fully minted.</p>
              </div>
            </div>

            <div className="biggi-card__body">
              {renderStaticPreview(
                "/images/rewards/rainbowNFT",
                mysteryCount,
                "Mystery",
              )}

              <div className="nft-rewards__status-list">
                {normalizedRange.map((block) => {
                  const claimed = Boolean(mysteryClaimed?.[block]);
                  return (
                    <div
                      key={`mys-${block}`}
                      className="nft-rewards__status-row"
                    >
                      <div className="nft-rewards__status-meta">
                        <span>Block {block}</span>
                        <small>1 Mystery NFT</small>
                      </div>
                      <span
                        className={`nft-rewards__status-pill ${claimed ? "is-claimed" : "is-open"}`}
                      >
                        {claimed ? "Minted" : "Awaiting mint"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <ul className="rewards-grid__info-list">
                <li>
                  One Mystery NFT per block, revealed after metadata is
                  published.
                </li>
                <li>
                  Metadata is served from the Mystery base URI listed above.
                </li>
              </ul>

              {contractAddress && (
                <div className="rewards-grid__actions">
                  <button
                    type="button"
                    className="biggi-btn biggi-btn--ghost"
                    onClick={() =>
                      typeof onOpenExplorer === "function" &&
                      onOpenExplorer(contractAddress)
                    }
                  >
                    View NFT Rewards on Explorer
                  </button>
                </div>
              )}
            </div>
          </article>

          <article className="biggi-card biggi-card--v rewards-panel__card nft-rewards__card nft-rewards__table-card">
            <div className="biggi-card__glow" aria-hidden />
            <div className="biggi-card__header">
              <div className="biggi-card__heading">
                <h3>Rewards by block</h3>
                <p>
                  Combined view of Character, Leaderboard, and Mystery mints.
                </p>
              </div>
            </div>
            <div className="biggi-card__body">
              <table className="nft-rewards__table">
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Character</th>
                    <th>Leaderboard</th>
                    <th>Mystery</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={`tbl-${row.block}`}>
                      <td>Block {row.block}</td>
                      <td>
                        <span
                          className={`nft-rewards__pill ${row.characterTone}`}
                        >
                          {row.character}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`nft-rewards__pill ${row.leaderboardTone}`}
                        >
                          {row.leaderboard}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`nft-rewards__pill ${row.mysteryTone}`}
                        >
                          {row.mystery}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export default NftRewardsSection;
