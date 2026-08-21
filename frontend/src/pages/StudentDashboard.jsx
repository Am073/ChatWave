import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getAnnouncements, markAsRead } from "../services/announcementService";
import AnnouncementCard from "../components/Feed/AnnouncementCard";
import AnnouncementsPage from "../components/Feed/AnnouncementsPage";
import ChatWindow from "../components/Chat/ChatWindow";
import BottomNav from "../components/Layout/BottomNav";
import SettingsModal from "../components/Settings/SettingsModal";
import { useCalendarConnectionToast } from "../hooks/useCalendarIntegration";
import { useAnnouncementStream } from "../hooks/useAnnouncementStream";
import { cn } from "../utils/cn";

const mapAnnouncement = (a, userId) => ({
  ...a,
  id: a._id,
  created_at: a.createdAt,
  posted_by_name: a.author?.name || "Faculty",
  is_read: a.read_by?.includes(userId) || false
});

export default function StudentDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("chat");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [activeAnnId, setActiveAnnId] = useState(null);
  const { events: liveEvents } = useAnnouncementStream(user?.id || user?._id);
  const processedLiveRef = useRef(0);

  const fetchData = async () => {
    try {
      const annRes = await getAnnouncements({ limit: 50 });
      const userId = user?.id || user?._id;
      const mapped = (annRes.data || []).map(a => mapAnnouncement(a, userId));
      setAnnouncements(mapped);
      setUnreadCount(mapped.filter(a => !a.is_read).length);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // Initial fetch: fetchData is async, so its setStates run after await,
    // never synchronously during the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live SSE announcements: merge newly pushed items into feed + unread badge.
  useEffect(() => {
    const fresh = liveEvents.slice(processedLiveRef.current);
    processedLiveRef.current = liveEvents.length;
    if (!fresh.length) return;
    const userId = user?.id || user?._id;
    const incoming = fresh
      .map(e => e.announcement)
      .filter(Boolean)
      .map(a => mapAnnouncement(a, userId));
    setAnnouncements(prev => {
      const seen = new Set(prev.map(a => a.id));
      return [...incoming.filter(a => !seen.has(a.id)), ...prev];
    });
    setUnreadCount(c => c + incoming.length);
  }, [liveEvents]);

  useCalendarConnectionToast();

  const handleAnnSelect = async (id) => {
    setActiveAnnId(id);
    const ann = announcements.find(a => a.id === id);
    if (ann && !ann.is_read) {
      try {
        await markAsRead(id);
        setAnnouncements(prev =>
          prev.map(a => (a.id === id ? { ...a, is_read: true } : a))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-cw-black overflow-hidden">
      {/* TOPBAR */}
      <div className="cw-topbar">
        {/* Logo */}
        <span className="cw-logo mr-5">ChatWave</span>

        {/* Nav */}
        <div className="flex gap-0.5 flex-1">
          {['Chat','Announcements'].map((item) => (
            <button key={item}
              id={`nav-tab-${item.toLowerCase()}`}
              onClick={() => setActiveTab(item.toLowerCase())}
              className={cn(
                "cw-nav-btn",
                activeTab === item.toLowerCase() ? "cw-nav-btn-active" : "cw-nav-btn-inactive"
              )}
            >{item}</button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Bell */}
          <div className="relative cw-icon-btn">
            🔔
            {unreadCount > 0 && (
              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border-[1.5px] border-cw-black" />
            )}
          </div>

          {/* Settings */}
          <button
            id="settings-btn"
            onClick={() => setSettingsOpen(true)}
            className="cw-icon-btn"
          >⚙</button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-gradient-to-br from-blue-700 to-cw-teal cursor-pointer shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || 'S'}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Feed sidebar - always mounted, hidden on mobile */}
        <div
          id="feed-sidebar"
          className="w-[260px] shrink-0 bg-cw-surface border-r border-white/[0.07] flex-col overflow-hidden hidden md:flex"
        >
          {/* Feed header */}
          <div className="px-3.5 py-3 border-b border-white/[0.07] flex items-center justify-between shrink-0">
            <span className="cw-section-header">Live Feed</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                {unreadCount}
              </span>
            )}
          </div>

          {/* Feed list */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[120px] gap-2">
                <span className="text-2xl">📭</span>
                <span className="text-[11px] text-cw-t3 text-center">No announcements yet</span>
              </div>
            ) : (
              announcements.map((ann) => (
                <AnnouncementCard
                  key={ann.id}
                  announcement={ann}
                  isActive={activeAnnId === ann.id}
                  onClick={handleAnnSelect}
                />
              ))
            )}
          </div>
        </div>

        {/* CHAT AREA - always mounted, hidden when announcements tab active */}
        <div
          className={cn(
            "flex-1 flex flex-col",
            "overflow-hidden min-w-0",
            activeTab === 'announcements' ? "hidden" : "flex"
          )}
        >
          <ChatWindow
            userId={user?.id || user?._id}
            collegeName={user?.college_name}
          />
        </div>

        {/* ANNOUNCEMENTS FULL PAGE VIEW - always mounted, hidden when chat tab */}
        <div
          className={cn(
            "flex-1 overflow-y-auto",
            activeTab === 'chat' ? "hidden" : "flex"
          )}
        >
          <AnnouncementsPage
            announcements={announcements}
            unreadCount={unreadCount}
            onMarkRead={handleAnnSelect}
            onRefresh={fetchData}
          />
        </div>

      </div>

      <div className="md:hidden">
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
