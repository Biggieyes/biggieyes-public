import { Fragment } from "preact";

export function isFragment(element) {
  return Boolean(element) && element.type === Fragment;
}

export const ForwardRef = Symbol.for("react.forward_ref");
export const Memo = Symbol.for("react.memo");

export function isMemo() {
  return false;
}

export function isValidElementType(type) {
  return typeof type === "string" || typeof type === "function";
}
