// src/components/header/IconRow.jsx
import * as React from "react";

function IconRowBase({ icons = [], onIconClick, className = "", style }) {
  const handleClick = React.useCallback(
    (idx, icon, e) => {
      icon?.onClick?.(e);
      if (!e.defaultPrevented) onIconClick?.(idx, icon, e);
    },
    [onIconClick],
  );

  const handleKey = React.useCallback(
    (idx, icon, e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick(idx, icon, e);
      }
    },
    [handleClick],
  );

  const transparentPx =
    "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

  // prohodit Info a User Panel
  const orderedIcons = [...icons];
  const infoIndex = orderedIcons.findIndex((icon) => icon?.key === "info");
  const userIndex = orderedIcons.findIndex((icon) => icon?.key === "user");
  if (infoIndex > -1) {
    const [infoIcon] = orderedIcons.splice(infoIndex, 1);
    orderedIcons.unshift(infoIcon); // Info první
  }
  if (userIndex > -1) {
    const [userIcon] = orderedIcons.splice(
      orderedIcons.findIndex((icon) => icon?.key === "user"),
      1,
    );
    orderedIcons.push(userIcon); // User Panel poslední
  }

  // yellow border for nav icon tiles
  const navBorder = "#ffe800";
  const baseBoxShadow = `0 0 0 1px rgba(0,0,0,.12), 0 6px 20px rgba(0,0,0,0.18)`;
  const glowSoft = `0 8px 30px rgba(255,232,0,0.18), 0 0 22px rgba(255,232,0,0.08)`;
  const glowStrong = `0 12px 36px rgba(255,232,0,0.26), 0 0 28px rgba(255,232,0,0.14)`;
  const activeInset = "inset 0 3px 8px rgba(0,0,0,0.45)";

  const applyHoverStyle = (el) => {
    if (!el) return;
    el.style.transform = "translateY(-4px) scale(1.02)";
    el.style.boxShadow = `${baseBoxShadow}, ${glowStrong}`;
  };
  const removeHoverStyle = (el) => {
    if (!el) return;
    el.style.transform = "none";
    el.style.boxShadow = `${baseBoxShadow}, ${glowSoft}`;
  };
  const applyActiveStyle = (el) => {
    if (!el) return;
    el.style.transform = "translateY(0) scale(0.995)";
    el.style.boxShadow = `${activeInset}, ${glowStrong}`;
  };

  return (
    <div
      className={`icon-row ${className}`}
      style={{ display: "flex", gap: 10, ...style }}
      role="list"
      aria-label="Icon shortcuts"
    >
      {orderedIcons.map((icon, idx) => {
        const key = icon?.key ?? icon?.alt ?? icon?.title ?? String(idx);
        const label = icon?.ariaLabel || icon?.alt || icon?.title || "icon";
        const width = Number.isFinite(icon?.width) ? icon.width : 100;
        const height = Number.isFinite(icon?.height) ? icon.height : 100;
        const eager = icon?.eager === true || idx < 3;
        const isDisabled = Boolean(icon?.disabled);

        const pad = 8;
        const wrapperWidth = width + pad * 2;
        const wrapperHeight = height + pad * 2;

        return (
          <div
            key={key}
            role="listitem"
            style={{
              width: wrapperWidth,
              height: wrapperHeight,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: pad,
              borderRadius: 14,
              border: `2px solid ${navBorder}`,
              backgroundImage: 'url("/images/blocks-bg2.png")',
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              boxShadow: `${baseBoxShadow}, ${glowSoft}`,
              transition:
                "border-color .18s ease, box-shadow .18s ease, transform .12s ease",
              willChange: "border-color, box-shadow, transform",
              flex: "0 0 auto",
              pointerEvents: isDisabled ? "none" : "auto",
              opacity: isDisabled ? 0.55 : 1,
            }}
            onMouseEnter={(e) => applyHoverStyle(e.currentTarget)}
            onMouseLeave={(e) => removeHoverStyle(e.currentTarget)}
            onFocus={(e) => applyHoverStyle(e.currentTarget)}
            onBlur={(e) => removeHoverStyle(e.currentTarget)}
            onMouseDown={(e) => applyActiveStyle(e.currentTarget)}
            onMouseUp={(e) => applyHoverStyle(e.currentTarget)}
            onTouchStart={(e) => applyActiveStyle(e.currentTarget)}
            onTouchEnd={(e) => applyHoverStyle(e.currentTarget)}
          >
            <button
              type="button"
              aria-label={label}
              title={icon?.title ?? icon?.alt}
              aria-disabled={isDisabled || undefined}
              onClick={(e) => handleClick(idx, icon, e)}
              onKeyDown={(e) => handleKey(idx, icon, e)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                margin: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isDisabled ? "not-allowed" : "pointer",
                borderRadius: 10,
                width: width,
                height: height,
                lineHeight: 0,
                overflow: "hidden",
                outline: "none",
              }}
              onFocus={(e) => {
                const wrapper = e.currentTarget.parentElement;
                if (wrapper) {
                  wrapper.style.boxShadow = `${baseBoxShadow}, ${glowStrong}`;
                }
              }}
              onBlur={(e) => {
                const wrapper = e.currentTarget.parentElement;
                if (wrapper)
                  wrapper.style.boxShadow = `${baseBoxShadow}, ${glowSoft}`;
              }}
            >
              <img
                src={icon?.src || transparentPx}
                width={width}
                height={height}
                className="mini-icon"
                alt={icon?.alt || ""}
                loading={eager ? "eager" : "React.lazy"}
                fetchPriority={eager ? "high" : "auto"}
                decoding={eager ? "sync" : "async"}
                draggable={false}
                onError={(e) => {
                  e.currentTarget.src = transparentPx;
                }}
                style={{
                  display: "block",
                  width: width,
                  height: height,
                  transition: "transform .18s ease, filter .12s ease",
                  transformOrigin: "center",
                  imageRendering: "pixelated",
                  filter:
                    "drop-shadow(0 6px 12px rgba(255,232,0,0.12)) drop-shadow(0 0 8px rgba(255,232,0,0.06))",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(IconRowBase);

