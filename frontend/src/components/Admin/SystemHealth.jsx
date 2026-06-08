import React from "react";

const SERVICE_CONFIG = {
  mongodb:          { label: "MongoDB Database",       icon: "🗄️" },
  vector_db:        { label: "Vector Database",        icon: "⚡" },
  llm:              { label: "AI / LLM Engine",        icon: "🤖" },
  websocket:        { label: "WebSocket Gateway",      icon: "🔌" },
  google_calendar:  { label: "Google Calendar API",   icon: "📅" },
};

function uptimeClass(u) {
  if (u == null) return 'text-cw-t3';
  if (u >= 95) return 'text-emerald-400';
  if (u >= 80) return 'text-amber-400';
  return 'text-red-400';
}

function barColor(u) {
  if (!u) return 'bg-cw-t3';
  if (u >= 95) return 'bg-emerald-400';
  if (u >= 80) return 'bg-amber-400';
  return 'bg-red-400';
}

export default function SystemHealth({ health, loading }) {
  return (
    <div className="cw-card overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
        <h3 className="cw-section-header">System Health</h3>
        {health?.overall === 'operational' ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            All systems operational
          </span>
        ) : (
          <span className="text-[10px] font-medium px-2 py-px rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
            Degraded
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-4">
        {loading ? (
          <div className="py-4 text-center text-xs text-cw-t3">Loading health data...</div>
        ) : (
          Object.entries(SERVICE_CONFIG).map(([key, cfg]) => {
            const service = health?.services?.[key] || { uptime: null };
            const u = service.uptime;
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{cfg.icon}</span>
                    <span className="text-xs text-cw-t2 font-medium">{cfg.label}</span>
                  </div>
                  <span className={`text-[10px] font-bold ${uptimeClass(u)}`}>
                    {u != null ? `${u}%` : 'N/A'}
                  </span>
                </div>
                {/* Progress bar — width must be inline */}
                <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor(u)}`}
                    style={{ width: `${u || 0}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
