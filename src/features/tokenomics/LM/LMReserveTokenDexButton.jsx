import * as React from "react";
import BiggiButton from "../../Common/components/BiggiButton.jsx";

const LMReserveTokenDexButton = ({ children = "TOKEN/DEX", ...props }) => (
  <BiggiButton variant="v" {...props}>
    {children}
  </BiggiButton>
);

export default LMReserveTokenDexButton;

