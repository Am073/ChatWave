import React from "react";
import AnnouncementCard from "./AnnouncementCard";

export default function AnnouncementFeed({ announcements = [], activeId, onSelect, loading }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3.5 py-3 border-b border-white/[0.07] flex items-center justify-between bg-cw-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <span className="cw-section-header">Live Feed</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-2 flex flex-col gap-1">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-cw-card animate-pulse h-14 w-full" />
          ))
        ) : announcements.length > 0 ? (
          announcements.map(ann => (
            <AnnouncementCard
              key={ann.id}
              announcement={ann}
              isActive={activeId === ann.id}
              onClick={onSelect}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-cw-t3 opacity-50">
            <span className="text-xl mb-1">📭</span>
            <span className="text-xs">No announcements yet</span>
          </div>
        )}
      </div>
    </div>
  );
}
