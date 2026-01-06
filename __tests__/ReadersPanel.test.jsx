import { render, screen, waitFor } from '@testing-library/react';
// import ReadersPanel from '../components/ReadersPanel';
// TODO: Opravit cestu k ReadersPanel komponentě
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
  it('fetches and displays reader data', async () => {
    render(<ReadersPanel />);
    await waitFor(() => {
      expect(screen.getByText(/1.0/)).toBeInTheDocument();
      expect(screen.getByText(/2.0/)).toBeInTheDocument();
    });
  });
});
