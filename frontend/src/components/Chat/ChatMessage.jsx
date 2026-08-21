import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import CalendarButton from './CalendarButton';
import BulkDatePicker from './BulkDatePicker';
import { cn } from '../../utils/cn';

/**
 * ChatMessage — renders a single chat bubble.
 *
 * If the bot response contains detected calendar-worthy dates, we show a
 * "Add to Calendar" affordance. Clicking it opens a modal where the user
 * can review and pick the dates they want to add to Google Calendar.
 */
export default function ChatMessage({ message, onAddCalendar }) {
  const { user } = useAuth();
  const isBot = message.role === 'bot';
  const initials = isBot ? 'CW' : (user?.name?.charAt(0) || 'U');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [detectedDates, setDetectedDates] = useState(
    () => message.detectedDates || (message.detectedDate ? [message.detectedDate] : []),
  );

  // If the parent updates the message (e.g. after the WS final frame),
  // re-sync the detected dates.
  useEffect(() => {
    if (message.detectedDates) {
      setDetectedDates(message.detectedDates);
    } else if (message.detectedDate) {
      setDetectedDates([message.detectedDate]);
    }
  }, [message.detectedDates, message.detectedDate]);

  const handleOpenPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const handleClosePicker = useCallback(() => {
    setPickerOpen(false);
    if (onAddCalendar) onAddCalendar();
  }, [onAddCalendar]);

  const count = detectedDates.length;
  const sources = message.sources || [];

  return (
    <div className={cn("flex gap-2 items-start", !isBot && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-bold text-white font-outfit",
        isBot ? "bg-gradient-to-br from-blue-800 to-cw-teal" : "bg-gradient-to-br from-emerald-900 to-emerald-500"
      )}>
        {initials}
      </div>

      {/* Content */}
      <div className="max-w-[75%] flex flex-col gap-1">
        {/* Bubble */}
        <div className={cn(
          "px-3 py-2 text-sm leading-relaxed font-dm break-words",
          isBot
            ? "bg-[#161b27] border border-white/[0.08] rounded-xl rounded-tl-sm text-cw-t1"
            : "bg-cw-blue/25 border border-cw-blue/30 rounded-xl rounded-tr-sm text-blue-200"
        )}>
          {message.content}
        </div>

        {/* Source badge */}
        {isBot && sources.length > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-cw-teal bg-cw-teal/[0.08] border border-cw-teal/20 w-fit">
            📌 {sources[0]?.name || sources[0]?.filename || 'College document'}
            {sources.length > 1 && (
              <span className="text-cw-t3">+{sources.length - 1} more</span>
            )}
          </div>
        )}

        {/* Smart calendar button */}
        {isBot && count > 0 && (
          <CalendarButton count={count} onClick={handleOpenPicker} />
        )}

        {/* Bulk picker modal */}
        {pickerOpen && (
          <BulkDatePicker
            open={pickerOpen}
            onClose={handleClosePicker}
            dates={detectedDates}
            chatContext={message.content}
          />
        )}
      </div>
    </div>
  );
}
