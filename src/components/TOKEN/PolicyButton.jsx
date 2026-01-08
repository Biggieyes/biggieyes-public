import * as React from "react";
import BiggiButton from "./BiggiButton";

const POLICYButton = ({ children = "POLICY", ...props }) => (
  <BiggiButton variant="y" {...props}>
    {children}
  </BiggiButton>
);

export default POLICYButton;


