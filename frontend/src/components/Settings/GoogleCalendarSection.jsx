import React, { useEffect, useState, useCallback } from 'react';
import {
  getCalendarStatus,
  getAuthUrl,
  syncCalendar,
  disconnectCalendar,
  listEvents,
} from '../../services/calendarService';

/**
 * Google Calendar section — full OAuth connect / event listing.
 *
 * Lifecycle:
 *  1. User clicks "Connect" -> we ask the backend for the consent URL, then
 *     open it in a popup.
 *  2. The popup completes Google's OAuth, our backend exchanges the code,
 *     and the user is returned to /settings/calendar?status=connected.
 *  3. We re-check status; the connect button becomes "Disconnect".
 */
export default function GoogleCalendarSection() {
  const [status, setStatus] = useState({ connected: false, loading: true });
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([
        getCalendarStatus(),
        listEvents().catch(() => ({ data: { events: [] } })),
      ]);
      setStatus({ connected: Boolean(s.data?.connected), loading: false });
      setEvents(e.data?.events || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
      setStatus((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
    // Check URL params for OAuth callback status.
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('status');
    if (flag) {
      // Clean the URL so a refresh doesn't repeat the toast.
      params.delete('status');
      const next = window.location.pathname + (params.toString() ? `?${params}` : '');
      window.history.replaceState({}, '', next);
    }
  }, [refresh]);

  const handleConnect = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { data } = await getAuthUrl();
      if (!data?.authorizationUrl) {
        throw new Error('Backend did not return an authorization URL');
      }
      // Open the consent URL in the same tab; the backend redirects back
      // to the frontend with a status query parameter.
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
      setBusy(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    setBusy(true);
    try {
      await disconnectCalendar();
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleSync = useCallback(async () => {
    setBusy(true);
    try {
      await syncCalendar();
      await refresh();
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-cw-card">
      <div className="px-4 py-2.5 border-b border-white/[0.07]">
        <span className="cw-section-header">Integrations</span>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-cw-t1 mb-1">Google Calendar</h4>
            <p className="text-[11px] text-cw-t3 leading-relaxed">
              Auto-save exam dates and upcoming events directly from chat answers.
            </p>
          </div>
          <span
            className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide mt-0.5 ${
              status.connected
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/[0.06] text-cw-t3'
            }`}
          >
            {status.connected ? 'Connected' : 'Not connected'}
          </span>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[11px] text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {status.connected ? (
            <>
              <button
                onClick={handleSync}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-cw-blue/30 bg-cw-blue/[0.08] text-blue-300 text-[11px] font-dm hover:bg-cw-blue/[0.16] disabled:opacity-50"
              >
                {busy ? 'Syncing…' : 'Sync events'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/[0.06] text-red-300 text-[11px] font-dm hover:bg-red-500/[0.12] disabled:opacity-50"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              disabled={busy || status.loading}
              className="px-3 py-1.5 rounded-lg border border-cw-blue/30 bg-cw-blue/[0.08] text-blue-300 text-[11px] font-dm hover:bg-cw-blue/[0.16] disabled:opacity-50"
            >
              {busy ? 'Opening…' : 'Connect Google Calendar'}
            </button>
          )}
        </div>

        {status.connected && events.length > 0 && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            <div className="text-[10px] uppercase tracking-wide text-cw-t3 font-dm">Upcoming</div>
            {events.slice(0, 8).map((ev) => (
              <div key={ev.id} className="text-[11px] text-cw-t2 font-dm truncate">
                <span className="text-cw-teal">●</span> {ev.title}
                <span className="text-cw-t3 ml-1.5">{ev.start}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
