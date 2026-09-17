import * as React from "react";

export const RewardsContext = React.createContext(null);

export function useREWARDS() {
  const v = React.useContext(RewardsContext);
  if (!v) throw new Error("useREWARDS must be used inside <REWARDSProvider>");
  return v;
}
