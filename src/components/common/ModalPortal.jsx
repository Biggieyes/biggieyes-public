// src/components/common/ModalPortal.jsx
import * as React from "react";
import * as ReactDOM from "react-dom";

const HOST_ID = "biggi-modal-root";

function ensureModalHost() {
  if (typeof document === "undefined") return null;
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    document.body.appendChild(host);
  }
  return host;
}

export default function ModalPortal({
  children,
  className,
  lockScroll = true,
}) {
  const containerRef = React.useRef(null);
  const previousOverflow = React.useRef("");
  const previousPaddingRight = React.useRef("");
  const previousPosition = React.useRef("");
  const previousTop = React.useRef("");
  const previousLeft = React.useRef("");
  const previousRight = React.useRef("");
  const previousWidth = React.useRef("");
  const previousScrollY = React.useRef(0);

  if (!containerRef.current && typeof document !== "undefined") {
    containerRef.current = document.createElement("div");
    containerRef.current.setAttribute("role", "presentation");
  }

  React.useEffect(() => {
    const host = ensureModalHost();
    const container = containerRef.current;
    if (!host || !container) return undefined;

    if (className) container.className = className;
    host.appendChild(container);

    if (lockScroll && typeof document !== "undefined") {
      const body = document.body;
      const scrollbarW =
        window.innerWidth - document.documentElement.clientWidth;
      previousOverflow.current = body.style.overflow;
      previousPaddingRight.current = body.style.paddingRight;
      previousPosition.current = body.style.position;
      previousTop.current = body.style.top;
      previousLeft.current = body.style.left;
      previousRight.current = body.style.right;
      previousWidth.current = body.style.width;
      previousScrollY.current = window.scrollY || window.pageYOffset || 0;
      if (scrollbarW > 0) {
        const cur = parseFloat(body.style.paddingRight || "0") || 0;
        body.style.paddingRight = `${cur + scrollbarW}px`;
      }
      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${previousScrollY.current}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
    }

    return () => {
      if (lockScroll && typeof document !== "undefined") {
        const body = document.body;
        body.style.overflow = previousOverflow.current;
        body.style.paddingRight = previousPaddingRight.current;
        body.style.position = previousPosition.current;
        body.style.top = previousTop.current;
        body.style.left = previousLeft.current;
        body.style.right = previousRight.current;
        body.style.width = previousWidth.current;
        window.scrollTo(0, previousScrollY.current);
      }
      if (host && container && container.parentNode === host)
        host.removeChild(container);
    };
  }, [className, lockScroll]);

  const portalContent = React.useMemo(() => children, [children]);

  if (typeof document === "undefined" || !containerRef.current) return null;
  return ReactDOM.createPortal(portalContent, containerRef.current);
}
