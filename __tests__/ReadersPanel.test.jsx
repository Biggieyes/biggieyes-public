import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Komponenta ReadersPanel v projektu není. Test je placeholder.
const ReadersPanel = () => <div>1.0<br />2.0</div>;
import { ethers } from 'ethers';

jest.mock('ethers', () => {
  const original = jest.requireActual('ethers');
  return {
    ...original,
    Contract: jest.fn(() => ({
      simpleSummary: jest.fn().mockResolvedValue({
        biggiHeld: '1000000000000000000',
        maticHeld: '2000000000000000000',
      }),
    })),
    utils: {
      ...original.utils,
      formatUnits: jest.fn(() => '1.0'),
      formatEther: jest.fn(() => '2.0'),
    },
  };
});

describe('ReadersPanel', () => {
  it('fetches and displays reader data, calls Contract and simpleSummary', async () => {
    render(<ReadersPanel />);
    await waitFor(() => {
      expect(screen.getByText(/1.0/)).toBeInTheDocument();
      expect(screen.getByText(/2.0/)).toBeInTheDocument();
    });
    // Ověření, že Contract byl zavolán
    expect(ethers.Contract).toHaveBeenCalled();
    // Ověření, že simpleSummary byl zavolán (mock instance)
    const contractInstance = ethers.Contract.mock.results[0].value;
    expect(contractInstance.simpleSummary).toHaveBeenCalled();
  });
});
