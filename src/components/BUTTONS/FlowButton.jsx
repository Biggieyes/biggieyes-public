import * as React from "react";
import BiggiButton from "./BiggiButton";

const FlowButton = ({ children = "Flow", ...props }) => (
  <BiggiButton variant="accent" {...props}>
    {children}
  </BiggiButton>
);

export default FlowButton;
