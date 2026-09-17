import * as React from "react";

export const Web3Context = React.createContext(null);

export function useWeb3() {
  const v = React.useContext(Web3Context);
  if (!v) throw new Error("useWeb3 must be used inside <Web3Provider>");
  return v;
}

export function useOptionalWeb3() {
  return React.useContext(Web3Context);
}
