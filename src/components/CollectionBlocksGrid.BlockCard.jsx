/**
 * BlockCard Component
 * Jednotlivá karta bloku v gridu
 */

import * as React from "react";
import { formatPrice, formatCount } from "./CollectionBlocksGrid.utils";
import { THUMB_SIZE } from "./CollectionBlocksGrid.constants";
import { handleImageError } from "../utils/images";

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
  }) => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onKeyDown(e, entry.name);
      }
    };

    return (
      <div
        className={`collection-grid__card${isHovered ? " is-hovered" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => onOpen(entry.name)}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => {
          if (!isTouch) onMouseEnter(entry.name);
        }}
        onMouseLeave={() => {
          if (!isTouch) onMouseLeave();
        }}
        aria-label={`Open ${entry.name} block preview`}
      >
        <div className="collection-grid__card-header" style={entry.buttonStyle}>
          <span>{entry.name}</span>
        </div>

        <div className="collection-grid__thumb">
          <img
            src={entry.thumb}
            alt={`${entry.name} thumbnail`}
            width={THUMB_SIZE}
            height={THUMB_SIZE}
            loading="React.lazy"
            decoding="async"
            onError={handleImageError}
          />
        </div>

        <dl className="collection-grid__meta">
          <div>
            <dt>Live price</dt>
            <dd>{formatPrice(entry.currentPrice)}</dd>
          </div>
          <div>
            <dt>Base price</dt>
            <dd>
              {entry.basePrice != null
                ? `${Math.round(entry.basePrice)} POL`
                : "--"}
            </dd>
          </div>
          <div>
            <dt>Minted</dt>
            <dd>{formatCount(entry.minted)}</dd>
          </div>
        </dl>

        {entry.diff && (
          <div
            className={`collection-grid__diff${entry.diff.positive ? " is-positive" : " is-negative"}`}
          >
            {entry.diff.value}
            <span>{entry.diff.percent}</span>
          </div>
        )}

        <span className="collection-grid__card-cta">{ctaLabel}</span>
      </div>
    );
  },
);

BlockCard.displayName = "BlockCard";

export default BlockCard;
