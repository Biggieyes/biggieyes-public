// src/components/common/ModalTopbar.jsx
import * as React from "react";
import PropTypes from "prop-types";

const ModalTopbar = React.memo(
  React.forwardRef(function ModalTopbar(
    {
      title,
      subtitle,
      onPrev,
      onNext,
      onClose,
      prevLabel = "Previous",
      nextLabel = "Next",
      closeLabel = "Close",
      className,
      style,
      leftSlot,
      rightSlot,
      raiseWalletModal = true,
      walletModalTop = "6vh",
      walletModalZ = 4000,
      prevIcon,
      nextIcon,
      closeIcon,
    },
    ref,
  ) {
    const colors = {
      text: "#f6f7fb",
      line: "rgba(255,255,255,.12)",
      accent: "#FFE800",
    };

    // --- Raise Web3Modal/WalletConnect modal higher globally ---
    React.useEffect(() => {
      if (!raiseWalletModal || typeof document === "undefined") return;

      const id = "w3m-wc-top-inject";
      let tag = document.getElementById(id);

      const css = `
:root { --w3m-modal-top: ${walletModalTop}; }
.w3m-modal, .wcm-modal {
  align-items: flex-start !important;
  padding-top: var(--w3m-modal-top) !important;
  z-index: ${walletModalZ} !important;
}
.w3m-modal__container, .wcm-modal__container { margin-top: 0 !important; }
.w3m-overlay, .wcm-overlay { z-index: ${walletModalZ - 1} !important; }
      `.trim();

      if (!tag) {
        tag = document.createElement("style");
        tag.id = id;
        tag.type = "text/css";
        tag.appendChild(document.createTextNode(css));
        document.head.appendChild(tag);
      } else {
        tag.textContent = css;
      }
    }, [raiseWalletModal, walletModalTop, walletModalZ]);

    // --- Phone-friendly tweaks ---
    const [isPhone, setIsPhone] = React.useState(false);

    React.useEffect(() => {
      if (typeof window === "undefined") return;
      const mq = window.matchMedia("(max-width: 700px)");
      const updatePhone = (e) => setIsPhone(e.matches);
      updatePhone(mq);

      try {
        mq.addEventListener("change", updatePhone);
      } catch {
        mq.addListener(updatePhone);
      }
      return () => {
        try {
          mq.removeEventListener("change", updatePhone);
        } catch {
          mq.removeListener(updatePhone);
        }
      };
    }, []);

    const titleId = React.useId();

    const topbarStyle = React.useMemo(
      () => ({
        background:
          "linear-gradient(145deg, rgba(255,232,0,.15), rgba(155,123,255,.14) 40%, rgba(39,217,210,.12))",
        border: `1px solid ${colors.accent}44`,
        borderRadius: isPhone ? 12 : 14,
        padding: isPhone ? "6px 8px" : "10px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: isPhone ? "wrap" : "nowrap",
        columnGap: isPhone ? 6 : 12,
        rowGap: isPhone ? 6 : 0,
        boxShadow:
          "inset 0 0 18px rgba(255,232,0,.12), 0 10px 26px rgba(0,0,0,.45)",
        color: colors.text,
        userSelect: "none",
        width: "100%",
        boxSizing: "border-box",
        ...style,
      }),
      [style, isPhone],
    );

    const TitleBlock = (
      <div style={{ minWidth: 0 }}>
        <h2
          id={titleId}
          style={{
            margin: 0,
            letterSpacing: 0.5,
            color: colors.accent,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: isPhone ? "58vw" : "55vw",
            fontSize: isPhone ? 15 : 18,
            lineHeight: 1.2,
          }}
          title={typeof title === "string" ? title : undefined}
        >
          {title}
        </h2>
        {subtitle && (
          <div
            style={{
              marginTop: 2,
              fontSize: isPhone ? 12 : 13,
              color: colors.text,
              opacity: 0.7,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: isPhone ? "58vw" : "55vw",
            }}
            aria-label={typeof subtitle === "string" ? subtitle : undefined}
          >
            {subtitle}
          </div>
        )}
      </div>
    );

    const IconButton = ({
      onClick,
      ariaLabel,
      titleAttr,
      children,
      disabled,
      marginRight = 8,
      tabIndex = 0,
    }) => (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onClick?.();
        }}
        aria-label={ariaLabel}
        title={titleAttr}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        tabIndex={disabled ? -1 : tabIndex}
        style={{
          width: isPhone ? 36 : 44,
          height: isPhone ? 36 : 44,
          marginRight: isPhone ? Math.min(marginRight, 4) : marginRight,
          borderRadius: 10,
          background:
            "linear-gradient(180deg, rgba(20,20,25,.85), rgba(8,8,12,.85))",
          border: `1px solid ${disabled ? colors.line : "rgba(255,232,0,.45)"}`,
          color: disabled ? colors.line : colors.accent,
          fontWeight: 900,
          fontSize: isPhone ? 15 : 18,
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: disabled
            ? "none"
            : "0 8px 20px rgba(0,0,0,.45), inset 0 0 18px rgba(255,232,0,.08)",
          backdropFilter: "blur(6px)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          touchAction: "manipulation",
          outline: "none",
          transition: "box-shadow 0.2s",
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow =
            "0 0 0 2px #FFE800, 0 8px 20px rgba(0,0,0,.45), inset 0 0 18px rgba(255,232,0,.08)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = disabled
            ? "none"
            : "0 8px 20px rgba(0,0,0,.45), inset 0 0 18px rgba(255,232,0,.08)";
        }}
      >
        {children}
      </button>
    );

    const handleKey = (e) => {
      if (e.key === "ArrowLeft" && typeof onPrev === "function") {
        e.stopPropagation();
        onPrev();
      } else if (e.key === "ArrowRight" && typeof onNext === "function") {
        e.stopPropagation();
        onNext();
      } else if (e.key === "Escape" && typeof onClose === "function") {
        e.stopPropagation();
        onClose();
      }
    };

    return (
      <div
        ref={ref}
        className={className}
        style={topbarStyle}
        role="toolbar"
        aria-labelledby={titleId}
        tabIndex={0}
        onKeyDown={handleKey}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: isPhone ? 6 : 10,
            minWidth: 0,
          }}
        >
          {leftSlot}
          {TitleBlock}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: isPhone ? 4 : 8,
            flexWrap: "wrap",
            marginTop: isPhone ? 2 : 0,
          }}
        >
          {typeof onPrev === "function" && (
            <IconButton
              onClick={onPrev}
              ariaLabel={prevLabel}
              titleAttr={prevLabel}
              disabled={false}
            >
              {prevIcon || "<"}
            </IconButton>
          )}

          {typeof onNext === "function" && (
            <IconButton
              onClick={onNext}
              ariaLabel={nextLabel}
              titleAttr={nextLabel}
              disabled={false}
            >
              {nextIcon || ">"}
            </IconButton>
          )}

          {rightSlot}

          {typeof onClose === "function" && (
            <IconButton
              onClick={onClose}
              ariaLabel={closeLabel}
              titleAttr={closeLabel}
              disabled={false}
              marginRight={0}
            >
              {closeIcon || "X"}
            </IconButton>
          )}
        </div>
      </div>
    );
  }),
);

ModalTopbar.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  onPrev: PropTypes.func,
  onNext: PropTypes.func,
  onClose: PropTypes.func,
  prevLabel: PropTypes.string,
  nextLabel: PropTypes.string,
  closeLabel: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  leftSlot: PropTypes.node,
  rightSlot: PropTypes.node,
  raiseWalletModal: PropTypes.bool,
  walletModalTop: PropTypes.string,
  walletModalZ: PropTypes.number,
  prevIcon: PropTypes.node,
  nextIcon: PropTypes.node,
  closeIcon: PropTypes.node,
};

export default ModalTopbar;
