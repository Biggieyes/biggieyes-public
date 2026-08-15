import * as React from "react";
import { explorerLink, isAddress, shortAddr } from "../utils/format";
import "./MainnetDataRail.css";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const hasValue = (value) => value !== null && value !== undefined && value !== "";

const isLiveAddress = (value) =>
  isAddress(value) && String(value).toLowerCase() !== ZERO_ADDRESS;

function MainnetDataRail({ items = [], title = "Mainnet data" }) {
  const rows = items.filter(Boolean);
  if (!rows.length) return null;

  return (
    <section className="tokenomics-mainnet-rail" aria-label={title}>
      {rows.map((item) => {
        const liveAddress = isLiveAddress(item.address);
        const value = liveAddress
          ? shortAddr(item.address)
          : hasValue(item.value)
            ? item.value
            : item.address
              ? "Not configured"
              : "--";
        const href = liveAddress ? item.href || explorerLink(item.address) : null;
        const tone = item.tone || (liveAddress || hasValue(item.value) ? "ok" : "warn");

        return (
          <div
            className={`tokenomics-mainnet-rail__item tokenomics-mainnet-rail__item--${tone}`}
            key={item.label}
          >
            <span className="tokenomics-mainnet-rail__label">{item.label}</span>
            <span className="tokenomics-mainnet-rail__value">
              <span title={liveAddress ? item.address : undefined}>{value}</span>
              {href ? (
                <a
                  className="tokenomics-mainnet-rail__link"
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                >
                  Explorer
                </a>
              ) : null}
            </span>
          </div>
        );
      })}
    </section>
  );
}

export default React.memo(MainnetDataRail);
