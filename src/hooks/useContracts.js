// src/hooks/useContract.js
import * as React from "react";
import { ContractsContext } from "../providers/ContractsProvider";

/**
 * Vrací všechny instance kontraktů z ContractsProvideru.
 * Používej v hookách nebo komponentách, které potřebují volat kontrakty.
 */
export function useContracts() {
  const ctx = React.useContext(ContractsContext);
  if (!ctx)
    throw new Error("useContracts must be used inside <ContractsProvider>");
  return ctx;
}

export default useContracts;
