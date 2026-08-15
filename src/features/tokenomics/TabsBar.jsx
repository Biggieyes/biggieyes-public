import * as React from "react";

const TabsBar = ({ tabs = [], active, onChange }) => {
  if (!tabs?.length) return null;
  return (
    <div className="view-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
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

