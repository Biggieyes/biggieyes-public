import * as React from "react";
import BiggiButton from "../../../components/TOKEN/BiggiButton.jsx";

const Button = ({ variant = "ghost", children, ...props }) => (
  <BiggiButton variant={variant} {...props}>
    {children}
  </BiggiButton>
);

export default React.memo(Button);
