import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import BottomNav from "../components/Layout/BottomNav";
import DocumentUpload from "../components/Upload/DocumentUpload";
import UploadedDocumentsList from '../components/Upload/UploadedDocumentsList';
import PostAnnouncement from "../components/Upload/PostAnnouncement";
import SettingsModal from "../components/Settings/SettingsModal";
import { useCalendarConnectionToast } from "../hooks/useCalendarIntegration";
import { cn } from "../utils/cn";

export default function FacultyDashboard() {
  const [activeNav, setActiveNav] = useState("post");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user } = useAuth();
  const [docListRefresh, setDocListRefresh] = useState(0);

  useCalendarConnectionToast();

  return (
    <div className="flex flex-col min-h-screen bg-cw-black">
      {/* TOPBAR */}
      <div className="cw-topbar">
        <span className="cw-logo mr-5">ChatWave</span>

        <div className="flex gap-1 flex-1">
          {['post', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveNav(tab)}
              className={cn(
                "cw-nav-btn capitalize",
                activeNav === tab ? "cw-nav-btn-active" : "cw-nav-btn-inactive"
              )}
            >{tab}</button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSettingsOpen(true)}
            className="cw-icon-btn"
          >⚙</button>

          {/* Faculty avatar — purple gradient */}
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-gradient-to-br from-purple-700 to-purple-400 cursor-pointer shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || 'F'}
          </div>
        </div>
      </div>

      {/* Welcome Bar */}
      <div className="px-5 py-3 bg-cw-surface border-b border-white/[0.07] flex items-center justify-between shrink-0">
        <div>
          <div className="font-outfit text-base font-semibold text-cw-t1">Faculty Portal</div>
          <div className="text-[11px] text-cw-t3 mt-0.5">{user?.name} · {user?.department}</div>
        </div>
      </div>

      {/* Body Grid */}
      <main className="flex-1 p-5 grid grid-cols-1 md:grid-cols-2 gap-4 items-start overflow-y-auto">

        {/* Upload Panel */}
        <div className="cw-card p-5 flex flex-col gap-3.5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-cw-blue/10 flex items-center justify-center text-sm">📁</div>
            <span className="font-outfit text-sm font-semibold text-cw-t1">Upload Document</span>
          </div>
          <DocumentUpload
            onUploadComplete={() => setDocListRefresh(r => r + 1)}
          />
          <div className="border-t border-white/[0.07] mt-1" />
          <UploadedDocumentsList
            collegeName={user?.college_name}
            refreshTrigger={docListRefresh}
          />
        </div>

        {/* Broadcast Center Panel */}
        <div className="cw-card p-5 flex flex-col gap-3.5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-cw-teal/10 flex items-center justify-center text-sm">📢</div>
            <span className="font-outfit text-sm font-semibold text-cw-t1">Broadcast Center</span>
          </div>
          <PostAnnouncement />
        </div>

      </main>

      <div className="md:hidden">
        <BottomNav activeTab={activeNav} onTabChange={setActiveNav} role="faculty" />
      </div>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
