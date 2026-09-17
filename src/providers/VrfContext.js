import * as React from "react";

export const VrfContext = React.createContext(null);

export function useVRF() {
  const v = React.useContext(VrfContext);
  if (!v) throw new Error("useVRF must be used inside <VRFProvider>");
  return v;
}
