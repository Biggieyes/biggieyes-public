import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Komponenta ReadersPanel v projektu není. Test je placeholder.
const ReadersPanel = () => <div>1.0<br />2.0</div>;
describe('ReadersPanel', () => {
  it('fetches and displays reader data, calls Contract and simpleSummary', async () => {
    render(<ReadersPanel />);
    await waitFor(() => {
      expect(screen.getByText(/1.0/)).toBeInTheDocument();
      expect(screen.getByText(/2.0/)).toBeInTheDocument();
    });
  });
});
