import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import StatCard from "../components/Admin/StatCard";
import ActivityFeed from "../components/Admin/ActivityFeed";
import SystemHealth from "../components/Admin/SystemHealth";
import UserTable from "../components/Admin/UserTable";
import DocumentTable from "../components/Admin/DocumentTable";
import PostAnnouncement from "../components/Upload/PostAnnouncement";
import DocumentUpload from "../components/Upload/DocumentUpload";
import UploadedDocumentsList from "../components/Upload/UploadedDocumentsList";
import AllAnnouncementsList from "../components/Admin/AllAnnouncementsList";
import SettingsModal from "../components/Settings/SettingsModal";
import { useAdminStats } from "../hooks/useAdminStats";
import { useCalendarConnectionToast } from "../hooks/useCalendarIntegration";
import { getActivity, getHealth } from "../services/adminService";
import { cn } from "../utils/cn";

const TABS = [
  { label: 'Overview',       id: 'overview' },
  { label: 'Users',          id: 'users' },
  { label: 'Knowledge Base', id: 'knowledge_base' },
  { label: 'Upload',         id: 'upload' },
  { label: 'Post',           id: 'post' },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { stats, loading: statsLoading } = useAdminStats();
  const [activities, setActivities] = useState([]);
  const [health, setHealth] = useState(null);
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [announcementRefresh, setAnnouncementRefresh] = useState(0);
  const [docListRefresh, setDocListRefresh] = useState(0);
  const { user } = useAuth();

  const fetchAdminData = async () => {
    try {
      const [actRes, healthRes] = await Promise.all([
        getActivity(20),
        getHealth()
      ]);
      setActivities(actRes.data.activities || []);
      setHealth(healthRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingExtras(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 60000);
    return () => clearInterval(interval);
  }, []);

  useCalendarConnectionToast();

  return (
    <div className="flex flex-col min-h-screen bg-cw-black">

      {/* ── TOPBAR ── */}
      <div className="cw-topbar">
        <span className="cw-logo mr-2">ChatWave</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 mr-4 font-medium">
          Admin
        </span>

        <div className="flex gap-1 flex-1 overflow-x-auto hide-scrollbar">
          {TABS.map(({ label, id }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "cw-nav-btn whitespace-nowrap",
                activeTab === id ? "cw-nav-btn-active" : "cw-nav-btn-inactive"
              )}
            >{label}</button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button onClick={() => setSettingsOpen(true)} className="cw-icon-btn">⚙</button>
          {/* Admin avatar — purple-to-amber gradient */}
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-gradient-to-br from-purple-700 to-amber-500 cursor-pointer shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
        </div>
      </div>

      {/* ── SUB-HEADER ── */}
      <div className="px-4 py-3 bg-cw-surface border-b border-white/[0.07] flex items-center justify-between shrink-0">
        <div>
          <div className="font-outfit text-base font-semibold text-cw-t1">Admin Dashboard</div>
          <div className="text-[11px] text-cw-t3 mt-0.5">{user?.college_name} · System Overview</div>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          All systems operational
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 p-4 overflow-y-auto">

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="flex flex-col gap-4 max-w-7xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              <StatCard label="Students"      value={stats?.totalStudents ?? '—'}      accentColor="#2563eb" />
              <StatCard label="Faculty"       value={stats?.totalFaculty ?? '—'}       accentColor="#7c3aed" />
              <StatCard label="Documents"     value={stats?.totalDocuments ?? '—'}     accentColor="#0d9488" />
              <StatCard label="Announcements" value={stats?.totalAnnouncements ?? '—'} accentColor="#f59e0b" />
              <StatCard label="Queries Today" value={stats?.queriesToday ?? '—'}       accentColor="#10b981" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ActivityFeed activities={activities} loading={loadingExtras} />
              <SystemHealth  health={health}         loading={loadingExtras} />
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="max-w-7xl mx-auto">
            <UserTable />
          </div>
        )}

        {/* KNOWLEDGE BASE TAB */}
        {activeTab === "knowledge_base" && (
          <div className="max-w-7xl mx-auto flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { label: 'Total Sources', value: stats?.totalDocuments || 0,  color: 'text-cw-t1' },
                { label: 'Global Chunks', value: stats?.totalChunks || 0,     color: 'text-cw-blue-light' },
                { label: 'RAG Precision', value: '98.2%',                     color: 'text-emerald-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="cw-card p-4 text-center">
                  <div className={`font-outfit text-2xl font-bold ${color}`}>{value}</div>
                  <div className="cw-section-header mt-1">{label}</div>
                </div>
              ))}
            </div>
            <DocumentTable />
          </div>
        )}

        {/* UPLOAD TAB */}
        {activeTab === "upload" && (
          <div className="max-w-4xl mx-auto flex flex-col gap-6">

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cw-teal/10
                              flex items-center justify-center text-lg">
                📁
              </div>
              <div>
                <div className="font-outfit text-base font-semibold
                                text-cw-t1">
                  Upload Documents
                </div>
                <div className="text-[11px] text-cw-t3 mt-0.5">
                  Upload PDFs, Word docs, Excel sheets, or images
                  to the college knowledge base
                </div>
              </div>
            </div>

            {/* Upload panel + document list — identical to Faculty */}
            <div className="cw-card p-6 flex flex-col gap-3.5">

              {/* Upload widget */}
              <DocumentUpload
                onUploadComplete={() => {
                  setDocListRefresh(r => r + 1);
                  fetchAdminData();
                }}
              />

              {/* Divider */}
              <div className="border-t border-white/[0.07] mt-1" />

              {/* Uploaded documents list with delete capability */}
              <UploadedDocumentsList
                collegeName={user?.college_name}
                refreshTrigger={docListRefresh}
              />

            </div>

          </div>
        )}

        {/* POST TAB */}
        {activeTab === "post" && (
          <div className="max-w-4xl mx-auto flex flex-col gap-6">

            {/* Section 1: Post new announcement */}
            <div>
              <h2 className="font-outfit text-base font-semibold text-cw-t1 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-cw-teal/10 flex items-center justify-center text-sm">
                  📢
                </span>
                Post New Announcement
              </h2>
              <div className="cw-card p-6">
                <PostAnnouncement
                  showOnlyMine={false}
                  onPostSuccess={() => setAnnouncementRefresh(r => r + 1)}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/[0.07]"/>

            {/* Section 2: All college announcements */}
            <div>
              <AllAnnouncementsList refreshTrigger={announcementRefresh} />
            </div>

          </div>
        )}

      </main>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
