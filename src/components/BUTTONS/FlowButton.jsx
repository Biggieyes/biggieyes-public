import * as React from "react";
import BiggiButton from "./BiggiButton";

const FLOWButton = ({ children = "FLOW", ...props }) => (
  <BiggiButton variant="accent" {...props}>
    {children}
  </BiggiButton>
);

export default FLOWButton;


