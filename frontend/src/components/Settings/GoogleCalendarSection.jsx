import React from "react";

// FIX[8]: Calendar backend routes return 501 Not Implemented.
// Replaced with a Coming Soon placeholder matching the dark theme.

export default function GoogleCalendarSection() {
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
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/[0.06] text-cw-t3 text-[9px] font-bold uppercase tracking-wide mt-0.5">
            Coming Soon
          </span>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-center">
          <p className="text-[11px] text-cw-t3">
            🗓️ Google Calendar integration is coming in a future update.
          </p>
        </div>
      </div>
    </section>
  );
}
