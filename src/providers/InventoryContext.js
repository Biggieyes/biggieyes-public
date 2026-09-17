import * as React from "react";

export const InventoryContext = React.createContext(null);

export const useInventory = () => {
  return React.useContext(InventoryContext);
};
