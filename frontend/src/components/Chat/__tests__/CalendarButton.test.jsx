import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CalendarButton from '../CalendarButton';

describe('CalendarButton', () => {
  it('renders nothing when count is zero', () => {
    const { container } = render(<CalendarButton count={0} onClick={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a single-date affordance when count is 1', () => {
    render(<CalendarButton count={1} onClick={() => {}} />);
    const btn = screen.getByTestId('calendar-button');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toMatch(/Add to Google Calendar/i);
    expect(btn.dataset.count).toBe('1');
  });

  it('renders a multi-date affordance when count > 1', () => {
    render(<CalendarButton count={3} onClick={() => {}} />);
    const btn = screen.getByTestId('calendar-button');
    expect(btn.textContent).toMatch(/3 dates/);
    expect(btn.dataset.count).toBe('3');
  });

  it('invokes onClick when clicked', () => {
    const onClick = vi.fn();
    render(<CalendarButton count={2} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('calendar-button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onClick when disabled', () => {
    const onClick = vi.fn();
    render(<CalendarButton count={1} onClick={onClick} disabled />);
    fireEvent.click(screen.getByTestId('calendar-button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
