/**
 * First component test — also a smoke test for the jsdom ("ui") jest project.
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '@/components/Toast';

function Trigger({ message, type }: { message: string; type?: 'error' | 'success' | 'info' }) {
  const { toast } = useToast();
  return <button onClick={() => toast(message, type)}>notify</button>;
}

const renderWithProvider = (ui: React.ReactNode) =>
  render(<ToastProvider>{ui}</ToastProvider>);

describe('ToastProvider', () => {
  test('renders children', () => {
    renderWithProvider(<span>child content</span>);
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  test('shows a toast when one is raised', async () => {
    const user = userEvent.setup();
    renderWithProvider(<Trigger message="Saved project" type="success" />);

    await user.click(screen.getByRole('button', { name: 'notify' }));

    expect(screen.getByText('Saved project')).toBeInTheDocument();
  });

  test('auto-dismisses after the timeout', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    renderWithProvider(<Trigger message="Transient notice" />);
    await user.click(screen.getByRole('button', { name: 'notify' }));
    expect(screen.getByText('Transient notice')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(4001);
    });

    expect(screen.queryByText('Transient notice')).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});
