import * as React from "react";
import "./DestinationsTable.css";

const DestinationsTable = ({ title, items = [] }) => (
  <section className="destinations-table">
    <header className="destinations-table__head">
      <h4>{title}</h4>
    </header>
    <div className="destinations-table__list">
      {items.map((item) => (
        <div key={item.label} className="destinations-table__row">
          <div className="destinations-table__label">{item.label}</div>
          <div className="destinations-table__value">
            <span>{item.amount}</span>
            {item.share && <small>{item.share}</small>}
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default DestinationsTable;

