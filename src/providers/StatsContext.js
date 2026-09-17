import * as React from "react";

export const StatsContext = React.createContext(null);

export function useStats() {
  const v = React.useContext(StatsContext);
  if (!v) throw new Error("useStats must be used inside <StatsProvider>");
  return v;
}
