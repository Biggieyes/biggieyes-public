import * as React from "react";
import BiggiButton from "./BiggiButton";

const BUYBACKDRIPButton = ({ children = "BUYBACK / DRIP", ...props }) => (
  <BiggiButton variant="c" {...props}>
    {children}
  </BiggiButton>
);

export default BUYBACKDRIPButton;



