import React from 'react';
import { Calendar as CalendarIcon, CalendarPlus } from 'lucide-react';

/**
 * Smart CalendarButton — shown beneath a bot message that has detected
 * calendar-worthy dates. The label reflects how many dates were found and
 * clicking the button opens the BulkDatePicker modal.
 *
 * Props:
 *  - count: number of detected dates
 *  - onClick: () => void — open the picker
 *  - disabled: bool — optional
 */
export default function CalendarButton({ count = 0, onClick, disabled = false }) {
  if (!count) return null;
  const single = count === 1;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={single ? 'Add this date to your Google Calendar' : `Review ${count} dates from this answer`}
      data-testid="calendar-button"
      data-count={count}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium text-cw-teal bg-cw-teal/[0.10] border border-cw-teal/30 hover:bg-cw-teal/[0.18] hover:border-cw-teal/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
    >
      {single ? <CalendarPlus size={10} /> : <CalendarIcon size={10} />}
      <span>
        {single ? 'Add to Google Calendar' : `${count} dates · Add to Calendar`}
      </span>
    </button>
  );
}
