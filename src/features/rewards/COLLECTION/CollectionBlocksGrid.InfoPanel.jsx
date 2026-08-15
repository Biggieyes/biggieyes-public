/**
 * InfoPanel Component
 * Panel s informacemi o blocích
 */

import * as React from "react";
import { INFO_CONCEPTS } from "./COLLECTIONBlocksGrid.constants";

const InfoPanel = React.memo(
  ({ isOpen, onClose, blockEntries, formatPrice, formatCount }) => {
    if (!isOpen) return null;

    return (
      <div
        id="collection-info-panel"
        className="collection-grid__info"
        role="dialog"
        aria-label="COLLECTION details"
      >
        <div className="collection-grid__info-content">
          <div className="collection-grid__info-top">
            <h3>COLLECTION quick guide</h3>
            <button
              type="button"
              className="collection-grid__close-btn"
              onClick={onClose}
              aria-label="Close information panel"
            >
              Close
            </button>
          </div>

          <div className="collection-grid__info-body">
            <div className="collection-grid__info-column">
              <table className="collection-grid__table collection-grid__table--info collection-grid__table--info-guide">
                <thead>
                  <tr>
                    <th>Concept</th>
                    <th>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {INFO_CONCEPTS.map((c) => (
                    <tr key={c.concept}>
                      <td>{c.concept}</td>
                      <td>{c.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="collection-grid__info-column">
              <table className="collection-grid__table collection-grid__table--info collection-grid__table--info-blocks">
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Price</th>
                    <th>Minted</th>
                    <th>Base</th>
                  </tr>
                </thead>
                <tbody>
                  {blockEntries
                    .filter((e) => e.hasData)
                    .map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{formatPrice(row.currentPrice)}</td>
                        <td>{formatCount(row.minted)}</td>
                        <td>
                          {row.basePrice != null
                            ? `${Math.round(row.basePrice)} POL`
                            : "--"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="collection-grid__subtitle">
          Explore live pricing, remaining supply, and expansion pressure for
          every block tier with data refreshed from on-chain reads.
        </p>
      </div>
    );
  },
);

InfoPanel.displayName = "InfoPanel";

export default InfoPanel;


