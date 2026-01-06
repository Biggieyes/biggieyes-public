import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// import FindTicket from '../components/FindTicket';
// TODO: Opravit cestu k FindTicket komponentě

describe('FindTicket', () => {
  it('renders and allows ticket search', async () => {
    render(<FindTicket />);
    const input = screen.getByPlaceholderText(/ticket/i);
    expect(input).toBeInTheDocument();
    userEvent.type(input, '12345');
    // Add more assertions for search result
  });
});
