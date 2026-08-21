import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BulkDatePicker from '../BulkDatePicker';

// Hoisted mocks: vi.hoisted runs before vi.mock, so the mock factory can
// safely reference the variables below.
const { mockGetCalendarStatus, mockBulkAddEvents } = vi.hoisted(() => ({
  mockGetCalendarStatus: vi.fn().mockResolvedValue({ data: { connected: true } }),
  mockBulkAddEvents: vi.fn(),
}));

vi.mock('../../../services/calendarService', () => ({
  getCalendarStatus: mockGetCalendarStatus,
  bulkAddEvents: mockBulkAddEvents,
}));

const sampleDates = [
  {
    date: '2026-03-15',
    label: 'Exam date',
    context: 'The mid-term examination is on 2026-03-15.',
    confidence: 0.95,
    raw: '2026-03-15',
    position: 0,
  },
  {
    date: '2026-05-20',
    label: 'Deadline date',
    context: 'Final project deadline is 2026-05-20.',
    confidence: 0.9,
    raw: '2026-05-20',
    position: 0,
  },
  {
    date: '2026-06-01',
    label: 'Holiday date',
    context: 'Summer break starts 2026-06-01.',
    confidence: 0.85,
    raw: '2026-06-01',
    position: 0,
  },
];

describe('BulkDatePicker', () => {
  beforeEach(() => {
    // Reset the calendar service mocks to their default implementations
    // so cross-test state (e.g. mockResolvedValueOnce) does not leak.
    mockGetCalendarStatus.mockReset();
    mockGetCalendarStatus.mockResolvedValue({ data: { connected: true } });
    mockBulkAddEvents.mockReset();
    mockBulkAddEvents.mockImplementation((events) =>
      Promise.resolve({
        data: {
          summary: {
            total: events.length,
            succeeded: events.length,
            failed: 0,
          },
          results: events.map((e, i) => ({ ok: true, title: e.title, id: `g-${i}` })),
        },
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <BulkDatePicker open={false} onClose={() => {}} dates={sampleDates} />,
    );
    expect(container.querySelector('[data-testid="bulk-date-picker"]')).toBeNull();
  });

  it('renders the list of detected dates when open', () => {
    render(<BulkDatePicker open onClose={() => {}} dates={sampleDates} />);
    expect(screen.getByTestId('bulk-date-picker')).toBeInTheDocument();
    for (const d of sampleDates) {
      expect(screen.getByTestId(`date-row-${d.date}`)).toBeInTheDocument();
    }
  });

  it('pre-selects all dates by default', () => {
    render(<BulkDatePicker open onClose={() => {}} dates={sampleDates} />);
    const button = screen.getByTestId('add-selected');
    expect(button.textContent).toMatch(/Add 3 to Google Calendar/);
  });

  it('toggles a single date when its checkbox is clicked', () => {
    render(<BulkDatePicker open onClose={() => {}} dates={sampleDates} />);
    const row = screen.getByTestId('date-row-2026-03-15');
    const checkbox = row.querySelector('input[type="checkbox"]');
    fireEvent.click(checkbox);
    expect(screen.getByTestId('add-selected').textContent).toMatch(/Add 2/);
  });

  it('toggles all dates when select-all is clicked', () => {
    render(<BulkDatePicker open onClose={() => {}} dates={sampleDates} />);
    fireEvent.click(screen.getByTestId('select-all'));
    // After deselect, the button should be disabled (0 selected).
    const btn = screen.getByTestId('add-selected');
    expect(btn).toBeDisabled();
  });

  it('submits the selected dates via bulkAddEvents', async () => {
    render(<BulkDatePicker open onClose={() => {}} dates={sampleDates} />);
    fireEvent.click(screen.getByTestId('add-selected'));
    await waitFor(() => {
      expect(mockBulkAddEvents).toHaveBeenCalledTimes(1);
    });
    const call = mockBulkAddEvents.mock.calls[0][0];
    expect(call).toHaveLength(3);
    expect(call[0].title).toBe('Exam date');
    expect(call[0].start_time).toMatch(/2026-03-15/);
  });

  it('shows the success banner when all events are added', async () => {
    render(<BulkDatePicker open onClose={() => {}} dates={sampleDates} />);
    fireEvent.click(screen.getByTestId('add-selected'));
    await waitFor(() => {
      expect(screen.getByTestId('bulk-result-banner')).toBeInTheDocument();
    });
    expect(screen.getByTestId('bulk-result-banner').textContent).toMatch(
      /Added 3 of 3 events/i,
    );
  });

  it('closes the modal when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<BulkDatePicker open onClose={onClose} dates={sampleDates} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables the submit button when Google Calendar is not connected', async () => {
    mockGetCalendarStatus.mockResolvedValueOnce({ data: { connected: false } });
    render(<BulkDatePicker open onClose={() => {}} dates={sampleDates} />);
    await waitFor(() => {
      const btn = screen.getByTestId('add-selected');
      expect(btn).toBeDisabled();
    });
  });
});
