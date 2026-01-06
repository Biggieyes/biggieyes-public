import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WalletConnectButton from '../src/components/WalletConnectButton.jsx';

describe('WalletConnectButton', () => {
  it('renders and triggers wallet connect', async () => {
    render(<WalletConnectButton />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    // Simulate click (mock actual wallet logic in real test)
    userEvent.click(button);
    // Add more assertions as needed for wallet connection state
  });
});
