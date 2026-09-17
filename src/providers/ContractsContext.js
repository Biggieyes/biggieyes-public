import * as React from "react";

export const ContractsContext = React.createContext(null);

export function useContracts() {
  const context = React.useContext(ContractsContext);
  if (!context)
    throw new Error("useContracts must be used inside <ContractsProvider>");
  return context;
}

export function useOptionalContracts() {
  return React.useContext(ContractsContext);
}
