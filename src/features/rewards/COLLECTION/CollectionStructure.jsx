import * as React from "react";
import {
  BACKGROUND_BONUS_PCT,
  BACKGROUND_GROWTH_PCT,
  BASE_PRICES,
  BTN_STYLES,
  DEFAULT_BLOCKS,
  MAX_SUPPLY_BY_BLOCK,
  ROWS_BY_BLOCK,
} from "@/shared/blocks";
import { formatCount, formatPrice } from "./COLLECTIONBlocksGrid.utils";
import PanelInfoButton from "@/components/common/PanelInfoButton";
import PanelInfoModal from "@/components/common/PanelInfoModal";
import "./CollectionStructure.css";

const MECHANICS_INFO = [
  {
    label: "VRF supply",
    description:
      "Each chapter has 550 mintable VRF NFTs: ten character IDs per eye-color block, with 10 to 1 background variants per character. The final redeemer of a completed block receives an additional character NFT, outside the 550 mintable NFTs (up to ten extra rewards per chapter).",
  },
  {
    label: "Same-color price growth",
    description:
      "Every completed VRF redeem increases the current price of the block matching the background color, regardless of the NFT's eye color. This affects that chapter only. Repeated increases compound on the current price; there is no next-block link.",
  },
  {
    label: "Recorded NFT value",
    description:
      "The background increase happens first. The contract then records the minted NFT's own block price plus its background bonus. If eyes and background match, the bonus uses the newly increased block price. This recorded value is not an extra POL payment at redeem; network gas still applies. The ticket's purchase price is stored separately.",
  },
  {
    label: "Public companion",
    description:
      "Public mint has 100 fixed NFTs, ten per block, without selectable background variants or a background price bonus. Its primary mint price is the current price from that chapter's VRF price provider. Public mint does not trigger the VRF background price increase. It remains subject to the chapter, ticket-phase, metadata and pause gates.",
  },
  {
    label: "Live values",
    description:
      "Current prices and minted counts use the same selected-collection reads as the block cards. Missing data is shown as --. Starting prices, supply limits and background percentages describe the deployed CORE rules. The owner can also change a current block price directly.",
  },
];

const ColorName = ({ name }) => (
  <span className="collection-structure__color">
    <span
      aria-hidden="true"
      className="collection-structure__swatch"
      style={{ background: BTN_STYLES[name]?.background }}
    />
    {name}
  </span>
);

export default function CollectionStructure({
  blockEntries = [],
  chapterId = 1,
  chapterName = "Originals",
  comingSoon = false,
}) {
  const [infoOpen, setInfoOpen] = React.useState(false);
  const byColor = new Map(
    blockEntries.map((entry) => [String(entry.name).trim().toUpperCase(), entry]),
  );
  const total = DEFAULT_BLOCKS.reduce((sum, name) => sum + MAX_SUPPLY_BY_BLOCK[name], 0);

  return (
    <section className="collection-structure" aria-label="Collection structure">
      <header className="collection-structure__header">
        <div>
          <h3>Chapter {chapterId}: {chapterName}</h3>
          <p>{total} VRF NFTs / 100 Public NFTs</p>
        </div>
        <PanelInfoButton
          onClick={() => setInfoOpen(true)}
          ariaLabel="Open collection structure information"
          title="Collection structure information"
        />
      </header>

      <div className="collection-structure__table-wrap">
        <table className="collection-structure__table">
          <caption>VRF blocks</caption>
          <thead>
            <tr>
              <th scope="col">Eye-color block</th>
              <th scope="col">Starting price</th>
              <th scope="col">Current price</th>
              <th scope="col">Minted / limit</th>
              <th scope="col">Character IDs</th>
              <th scope="col">Backgrounds per character</th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_BLOCKS.map((name, index) => {
              const entry = byColor.get(name);
              const base = Number.isFinite(entry?.basePrice) ? entry.basePrice : BASE_PRICES[name];
              return (
                <tr key={name}>
                  <th scope="row"><ColorName name={name} /></th>
                  <td data-label="Starting price">{formatPrice(base)}</td>
                  <td data-label="Current price" className="collection-structure__price">
                    {comingSoon ? "--" : formatPrice(entry?.currentPrice)}
                  </td>
                  <td data-label="Minted / limit">
                    {comingSoon ? "--" : formatCount(entry?.minted)} / {MAX_SUPPLY_BY_BLOCK[name]}
                  </td>
                  <td data-label="Character IDs">{index * 10 + 1}-{(index + 1) * 10}</td>
                  <td data-label="Backgrounds per character">{ROWS_BY_BLOCK[name]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="collection-structure__table-wrap">
        <table className="collection-structure__table">
          <caption>VRF background effects</caption>
          <thead>
            <tr>
              <th scope="col">Background</th>
              <th scope="col">NFT value bonus</th>
              <th scope="col">Block whose price grows</th>
              <th scope="col">Growth per redeem</th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_BLOCKS.map((name) => (
              <tr key={name}>
                <th scope="row"><ColorName name={name} /></th>
                <td data-label="NFT value bonus">+{BACKGROUND_BONUS_PCT[name]}%</td>
                <td data-label="Block whose price grows"><ColorName name={name} /></td>
                <td data-label="Growth per redeem" className="collection-structure__growth">
                  +{BACKGROUND_GROWTH_PCT[name]}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="collection-structure__rules">
        <div>
          <dt>Same-color growth</dt>
          <dd>A background anywhere in this VRF collection increases the price of its matching eye-color block, not the next block.</dd>
        </div>
        <div>
          <dt>Recorded VRF value</dt>
          <dd>Own block price after the growth step + (own block price x background bonus). No extra POL payment at redeem.</dd>
        </div>
        <div>
          <dt>Public collection</dt>
          <dd>100 fixed NFTs, ten per block. Primary mint uses this chapter&apos;s live VRF block price, without a background bonus or a VRF price increase.</dd>
        </div>
      </dl>

      <PanelInfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Collection structure"
        items={MECHANICS_INFO}
      />
    </section>
  );
}
