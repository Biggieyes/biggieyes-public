// src/components/panels/InfoPanel.jsx
import * as React from "react";

/**
 * Robustnější info panel: strukturované bloky o projektu, tokenomice a kontaktech.
 * Přijímá buď children (fallback), nebo si vyrenderuje default content, pokud nejsou děti.
 */
export default function InfoPanel({
  children,
  compact = false,
  data = null,
  loading = false,
  onRefresh,
}) {
  const hasData = Boolean(data);
  const showDefault = !children && !hasData;

  return (
    <section
      className="biggi-card biggi-skin"
      role="region"
      aria-label="Info panel"
      tabIndex={-1}
      style={{
        padding: compact ? 12 : 20,
        display: "grid",
        gap: compact ? 12 : 16,
      }}
    >
      {hasData && (
        <DynamicContent
          data={data}
          compact={compact}
          loading={loading}
          onRefresh={onRefresh}
        />
      )}
      {children && <div style={{ opacity: 0.9 }}>{children}</div>}
      {showDefault && <DefaultContent compact={compact} />}
    </section>
  );
}

// ...existing code...
