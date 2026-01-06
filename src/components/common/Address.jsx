// src/components/common/Address.jsx
import * as React from "react";

// Safe shortener
export function formatAddress(addr, start = 6, end = 4) {
  if (!addr || typeof addr !== "string") return "";
  const address = addr.trim();
  const s = Math.max(0, start);
  const e = Math.max(0, end);
  if (address.length <= s + e) return address;
  return `${address.slice(0, s)}...${address.slice(-e)}`;
}

// Basic EVM address check
export function isLikelyAddress(addr = "") {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

export default function Address({
  address,
  start = 6,
  end = 4,
  className = "",
  title,
  monospace = true,
  copy = true,
  onCopy,
  as: Tag = "span",
}) {
  const full = address?.trim() || "";
  if (!full) return null;

  const short = React.useMemo(
    () => formatAddress(full, start, end),
    [full, start, end],
  );
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef(null);

  const handleCopy = React.useCallback(
    async (e) => {
      if (!copy) return;
      e.stopPropagation();
      try {
        if (!navigator?.clipboard?.writeText)
          throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(full);
        setCopied(true);
        onCopy?.(full);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 1000);
      } catch {}
    },
    [copy, full, onCopy],
  );

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const baseStyle = monospace
    ? { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }
    : undefined;

  const isAddr = isLikelyAddress(full);

  return (
    <Tag
      className={className}
      style={{
        ...baseStyle,
        cursor: copy ? "pointer" : "inherit",
        userSelect: "text",
      }}
      title={title ?? full}
      aria-label={isAddr ? `Address ${full}` : full}
      role={copy ? "button" : undefined}
      tabIndex={copy ? 0 : undefined}
      onClick={handleCopy}
      onKeyDown={(e) => {
        if (!copy) return;
        if (e.key === "Enter" || e.key === " ") handleCopy(e);
      }}
      data-copied={copied ? "true" : "false"}
    >
      {short}
      {copy && (
        <sup
          aria-hidden="true"
          style={{
            marginLeft: 6,
            fontSize: "0.7em",
            opacity: copied ? 1 : 0.6,
            transition: "opacity .15s ease",
            letterSpacing: ".02em",
            color: copied ? "#21d07a" : "inherit",
          }}
        >
          {copied ? "copied" : "copy"}
        </sup>
      )}
    </Tag>
  );
}
