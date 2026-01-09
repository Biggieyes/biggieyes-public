import * as React from "react";

const Card = ({ title, subtitle, tone = "c", action, children }) => (
  <article className={`rewards-grid__card biggi-card biggi-card--${tone}`}>
    <div className="biggi-card__glow" aria-hidden />
    <div className="rewards-grid__card-header biggi-card__header">
      <div className="biggi-card__heading">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ? <div className="biggi-card__actions">{action}</div> : null}
    </div>
    <div className="biggi-card__body">{children}</div>
  </article>
);

export default React.memo(Card);
