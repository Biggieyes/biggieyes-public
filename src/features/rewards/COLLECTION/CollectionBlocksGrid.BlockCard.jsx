/**
 * BlockCard Component
 * Jednotlivá karta bloku v gridu
 */

import * as React from "react";
import { formatPrice, formatCount } from "./COLLECTIONBlocksGrid.utils";
import { THUMB_SIZE } from "./COLLECTIONBlocksGrid.constants";
import { handleImageError } from "../../../utils/images";

const BlockCard = React.memo(
  ({
    entry,
    isHovered,
    isTouch,
    onOpen,
    onKeyDown,
    onMouseEnter,
    onMouseLeave,
    ctaLabel = "Open preview",
    comingSoon = false,
  }) => {
    const handleKeyDown = (e) => {
      if (comingSoon) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onKeyDown(e, entry.name);
      }
    };

    return (
      <div
        className={`collection-grid__card${isHovered ? " is-hovered" : ""}${comingSoon ? " is-coming-soon" : ""}`}
        role={comingSoon ? undefined : "button"}
        tabIndex={comingSoon ? undefined : 0}
        onClick={() => {
          if (!comingSoon) onOpen(entry.name);
        }}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => {
          if (!comingSoon && !isTouch) onMouseEnter(entry.name);
        }}
        onMouseLeave={() => {
          if (!comingSoon && !isTouch) onMouseLeave();
        }}
        aria-label={
          comingSoon
            ? `${entry.name} block artwork coming soon`
            : `Open ${entry.name} block preview`
        }
      >
        <div className="collection-grid__card-header" style={entry.buttonStyle}>
          <span>{entry.name}</span>
        </div>

        <div className="collection-grid__thumb">
          {comingSoon ? (
            <div className="collection-grid__thumb-placeholder" aria-hidden>
              <strong>SOON</strong>
              <span>Artwork pending</span>
            </div>
          ) : (
            <img
              src={entry.thumb}
              data-fallback-src={entry.thumbFallback || undefined}
              alt={`${entry.name} thumbnail`}
              width={THUMB_SIZE}
              height={THUMB_SIZE}
              loading="lazy"
              decoding="async"
              onError={handleImageError}
            />
          )}
        </div>

        <dl className="collection-grid__meta">
          <div>
            <dt title="Live on-chain price (updates via VRF + background influence).">
              Live price
            </dt>
            <dd className="collection-grid__price-live">
              {comingSoon ? "--" : formatPrice(entry.currentPrice)}
            </dd>
          </div>
          <div>
            <dt title="Base price stored by the active chapter contract.">
              Base price
            </dt>
            <dd>
              {!comingSoon && entry.basePrice != null
                ? `${Math.round(entry.basePrice)} POL`
                : "--"}
            </dd>
          </div>
          <div>
            <dt>Minted</dt>
            <dd style={{ color: "#ff3b4f" }}>
              {comingSoon ? "--" : formatCount(entry.minted)}
            </dd>
          </div>
        </dl>

        {!comingSoon && entry.diff && (
          <div
            className={`collection-grid__diff${entry.diff.positive ? " is-positive" : " is-negative"}`}
          >
            {entry.diff.value}
            <span>{entry.diff.percent}</span>
          </div>
        )}

        <span className="collection-grid__card-cta">
          {comingSoon ? "SOON" : ctaLabel}
        </span>
      </div>
    );
  },
);

BlockCard.displayName = "BlockCard";

export default BlockCard;
