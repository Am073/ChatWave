import React from "react";
import { useCalendarIntegration } from "../../hooks/useCalendarIntegration";
import api from "../../services/api";

export default function GoogleCalendarSection() {
  const { calendarConnected, calendarLoading, checkStatus, handleConnect } = useCalendarIntegration();

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect Google Calendar?")) return;
    try {
      await api.delete("/calendar/disconnect");
      checkStatus();
    } catch {
      alert("Failed to disconnect calendar");
    }
  };

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
          {calendarConnected && (
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase tracking-wide mt-0.5">
              ✓ Connected
            </span>
          )}
        </div>

        {calendarConnected ? (
          <div className="flex gap-2">
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 text-xs font-dm font-medium rounded-lg border cursor-pointer transition-all bg-red-500/[0.06] border-red-500/25 text-red-300 hover:bg-red-500/15"
            >Disconnect</button>
            <button
              onClick={handleConnect}
              className="px-3 py-1.5 text-xs font-dm font-medium rounded-lg border cursor-pointer transition-all bg-white/[0.04] border-white/[0.10] text-cw-t2 hover:bg-white/[0.08] hover:text-cw-t1"
            >Reconnect</button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={calendarLoading}
            className="self-start flex items-center gap-2 px-4 py-2 rounded-xl bg-cw-blue text-white text-xs font-dm font-medium cursor-pointer hover:opacity-90 transition-opacity border-none disabled:opacity-50"
          >
            {calendarLoading ? "Checking..." : (
              <><span className="text-base">🔗</span>Connect Google Calendar</>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
