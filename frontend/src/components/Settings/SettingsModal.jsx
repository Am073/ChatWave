import React from "react";
import { useAuth } from "../../context/AuthContext";
import GoogleCalendarSection from "./GoogleCalendarSection";
import ChangePasswordSection from "./ChangePasswordSection";
import { useNavigate } from "react-router-dom";

export default function SettingsModal({ isOpen, onClose }) {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  const roleBadgeClass = {
    student: "bg-cw-blue/10 text-blue-300 border border-cw-blue/20",
    faculty: "bg-purple-500/10 text-purple-300 border border-purple-500/20",
    admin:   "bg-amber-500/10 text-amber-300 border border-amber-500/20",
  }[user?.role] ?? "bg-cw-blue/10 text-blue-300 border border-cw-blue/20";

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />

      {/* Slide-in panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] bg-cw-surface border-l border-white/[0.07] z-[51] flex flex-col">

        {/* Header — fixed at top, never scrolls */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
          <h2 className="font-outfit text-lg font-semibold text-cw-t1">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-cw-t3 hover:text-cw-t1 cursor-pointer transition-colors"
          >✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3 pb-12">

          {/* ── PROFILE ── */}
          <section className="rounded-2xl border border-white/[0.07] bg-cw-card">
            <div className="px-4 py-2.5 border-b border-white/[0.07]">
              <span className="cw-section-header">Profile</span>
            </div>
            {[
              { key: 'Full Name',  val: user?.name },
              { key: 'College ID', val: user?.college_id },
              { key: 'Department', val: user?.department },
              { key: 'College',    val: user?.college_name },
            ].map(({ key, val }) => (
              <div key={key} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] last:border-none">
                <span className="text-xs text-cw-t2">{key}</span>
                <span className="text-xs text-cw-t3 text-right max-w-[55%] truncate">{val || '—'}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-cw-t2">Role</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium capitalize ${roleBadgeClass}`}>
                {user?.role}
              </span>
            </div>
          </section>

          {/* ── INTEGRATIONS (Google Calendar) ── */}
          <GoogleCalendarSection />

          {/* ── SECURITY (Change Password) ── */}
          <ChangePasswordSection />

          {/* ── SESSION ── */}
          <section className="rounded-2xl border border-white/[0.07] bg-cw-card">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-cw-t2">Session</span>
              <button
                onClick={() => { logoutUser(); navigate('/login'); }}
                className="px-3 py-1.5 text-xs font-dm font-medium rounded-lg border cursor-pointer transition-all bg-red-500/[0.06] border-red-500/25 text-red-300 hover:bg-red-500/15 hover:text-red-200"
              >Sign out</button>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
