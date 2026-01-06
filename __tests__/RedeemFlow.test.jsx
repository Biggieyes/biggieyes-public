import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RedeemFlow from '../components/redeem/RedeemFlow.jsx';

describe('RedeemFlow', () => {
  it('renders and allows redeem', async () => {
    render(<RedeemFlow />);
    const button = screen.getByRole('button', { name: /redeem/i });
    expect(button).toBeInTheDocument();
    userEvent.click(button);
    // Add more assertions for redeem logic
  });
});
