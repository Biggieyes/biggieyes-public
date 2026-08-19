import * as React from "react";

const TabsBar = ({ tabs = [], active, onChange }) => {
  if (!tabs?.length) return null;
  return (
    <div className="view-tabs" role="tablist" aria-label="Ecosystem sections">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          tabIndex={active === tab.key ? 0 : -1}
          className={`tab-button ${active === tab.key ? "active" : ""}`}
          onClick={() => onChange?.(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default React.memo(TabsBar);
