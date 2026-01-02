import * as React from "react";
import BiggiButton from "./BiggiButton";

const PolicyButton = ({ children = "Policy", ...props }) => (
  <BiggiButton variant="y" {...props}>
    {children}
  </BiggiButton>
);

export default PolicyButton;
