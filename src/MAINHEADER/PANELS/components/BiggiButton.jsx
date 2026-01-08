import React from 'react';
const BiggiButton = ({ children, ...props }) => <button className="biggi-btn" {...props}>{children}</button>;
export default BiggiButton;

