import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { bulkAddEvents, getCalendarStatus } from '../../services/calendarService';

/**
 * BulkDatePicker — modal that lets the user review every date we detected
 * in a chat response and pick the ones they want to add to Google Calendar.
 *
 * Props:
 *  - open: bool — visibility
 *  - onClose: () => void
 *  - dates: array of { date, label, context, confidence, raw } from the API
 *  - chatContext: optional free-form text shown above the list
 */
export default function BulkDatePicker({ open, onClose, dates = [], chatContext = '' }) {
  const [selected, setSelected] = useState(() => new Set(dates.map((d) => d.date)));
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Re-initialize selection whenever the date list changes.
  useEffect(() => {
    setSelected(new Set(dates.map((d) => d.date)));
    setResult(null);
    setError(null);
  }, [dates]);

  // Probe Google Calendar status when the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getCalendarStatus();
        if (!cancelled) setConnected(Boolean(res.data?.connected));
      } catch {
        if (!cancelled) setConnected(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const allChecked = useMemo(
    () => selected.size === dates.length && dates.length > 0,
    [selected, dates],
  );

  const toggle = useCallback((iso) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === dates.length) return new Set();
      return new Set(dates.map((d) => d.date));
    });
  }, [dates]);

  const handleSubmit = useCallback(async () => {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const picked = dates.filter((d) => selected.has(d.date));
    const events = picked.map((d) => {
      const start = new Date(`${d.date}T09:00:00`);
      const end = new Date(`${d.date}T10:00:00`);
      return {
        title: d.label || 'Event',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        description: d.context,
      };
    });
    try {
      const res = await bulkAddEvents(events);
      setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  }, [dates, selected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-cw-card shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
        data-testid="bulk-date-picker"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-cw-t1 font-outfit">
              📅 Add to Calendar
            </h2>
            <p className="text-[11px] text-cw-t3 mt-0.5">
              {dates.length} date{dates.length === 1 ? '' : 's'} found
              {chatContext ? ' in the last answer' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-md text-cw-t3 hover:text-cw-t1 hover:bg-white/[0.06] text-sm"
          >
            ✕
          </button>
        </div>

        {/* Connection warning */}
        {connected === false && (
          <div className="px-5 py-2.5 bg-amber-500/[0.08] border-b border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
            <span>⚠️</span>
            <span>
              Google Calendar isn't connected yet. Open Settings → Integrations to
              connect your account, then try again.
            </span>
          </div>
        )}

        {/* Result banner */}
        {result && (
          <div
            className={`px-5 py-2.5 border-b text-[11px] flex items-center gap-2 ${
              result.summary.failed === 0
                ? 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-300'
                : 'bg-amber-500/[0.08] border-amber-500/20 text-amber-300'
            }`}
            data-testid="bulk-result-banner"
          >
            <span>{result.summary.failed === 0 ? '✓' : '⚠️'}</span>
            <span>
              Added {result.summary.succeeded} of {result.summary.total} event
              {result.summary.total === 1 ? '' : 's'} to Google Calendar
              {result.summary.failed > 0 ? ` (${result.summary.failed} failed)` : ''}.
            </span>
          </div>
        )}
        {error && (
          <div className="px-5 py-2.5 bg-red-500/[0.08] border-b border-red-500/20 text-[11px] text-red-300">
            {error}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {dates.length === 0 ? (
            <div className="text-center text-[12px] text-cw-t3 py-8">
              No dates detected in the last response.
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-cw-t3 cursor-pointer hover:bg-white/[0.03] rounded">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="accent-cw-teal"
                  data-testid="select-all"
                />
                <span>{allChecked ? 'Deselect all' : 'Select all'}</span>
                <span className="ml-auto text-[10px] text-cw-t3">
                  {selected.size} / {dates.length} selected
                </span>
              </label>
              {dates.map((d) => {
                const isSelected = selected.has(d.date);
                const dt = new Date(`${d.date}T00:00:00`);
                return (
                  <label
                    key={d.date}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-cw-teal/40 bg-cw-teal/[0.06]'
                        : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]'
                    }`}
                    data-testid={`date-row-${d.date}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(d.date)}
                      className="mt-0.5 accent-cw-teal"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-medium text-cw-t1">
                          {d.label}
                        </span>
                        <span className="text-[11px] text-cw-t2 font-dm">
                          {dt.toLocaleDateString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="text-[10px] text-cw-t3 ml-auto">
                          {Math.round((d.confidence || 0) * 100)}%
                        </span>
                      </div>
                      {d.context && (
                        <div className="text-[11px] text-cw-t3 mt-1 line-clamp-2">
                          {d.context}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.08] flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-white/[0.10] bg-white/[0.04] text-cw-t3 text-[11px] font-dm hover:bg-white/[0.08]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || dates.length === 0 || selected.size === 0 || connected === false}
            className="px-3 py-1.5 rounded-lg border border-cw-teal/40 bg-cw-teal/15 text-cw-teal text-[11px] font-dm hover:bg-cw-teal/25 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="add-selected"
          >
            {busy
              ? 'Adding…'
              : `Add ${selected.size} to Google Calendar`}
          </button>
        </div>
      </div>
    </div>
  );
}
