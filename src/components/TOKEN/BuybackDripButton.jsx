import * as React from "react";
import BiggiButton from "./BiggiButton";

const BuybackDripButton = ({ children = "Buyback / Drip", ...props }) => (
  <BiggiButton variant="c" {...props}>
    {children}
  </BiggiButton>
);

export default BuybackDripButton;
