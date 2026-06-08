import React from "react";

// accentColor is the one exception — it drives the top gradient bar and cannot be predefined
export default function StatCard({ label, value, delta, deltaUp, accentColor = '#2563eb' }) {
  return (
    <div className="cw-card relative overflow-hidden p-3.5">
      {/* Top accent bar — inline for dynamic color */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }}
      />
      <div className="cw-section-header mt-1">{label}</div>
      <div className="font-outfit text-3xl font-bold text-cw-t1 leading-none mt-1.5">
        {value ?? '—'}
      </div>
      {delta && (
        <div className={`text-[10px] mt-1 flex items-center gap-0.5 ${deltaUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {deltaUp ? '↑' : '↓'} {delta}
        </div>
      )}
    </div>
  );
}
