import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from '../ChatInput';

describe('ChatInput', () => {
  it('renders the input and send button', () => {
    render(<ChatInput onSend={() => {}} />);
    expect(screen.getByPlaceholderText(/ask anything/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onSend with trimmed value when Enter is pressed', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByPlaceholderText(/ask anything/i);
    await userEvent.type(input, '  Hello, world!  {enter}');
    expect(onSend).toHaveBeenCalledWith('Hello, world!');
    expect(input).toHaveValue('');
  });

  it('does not call onSend when the value is empty or whitespace', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByPlaceholderText(/ask anything/i);
    await userEvent.type(input, '   {enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('respects the disabled prop', () => {
    render(<ChatInput onSend={() => {}} disabled />);
    expect(screen.getByPlaceholderText(/ask anything/i)).toBeDisabled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onSend when the send button is clicked', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByPlaceholderText(/ask anything/i);
    await userEvent.type(input, 'Question?');
    fireEvent.click(screen.getByRole('button'));
    expect(onSend).toHaveBeenCalledWith('Question?');
  });
});
