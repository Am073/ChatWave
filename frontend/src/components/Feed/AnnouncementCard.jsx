import React from "react";
import { timeAgo } from "../../utils/dateHelpers";
import { cn } from "../../utils/cn";

// Tailwind-safe category classes (no dynamic color generation)
const CATEGORY_CONFIG = {
  exam:    { dot: "bg-red-500",    tag: "bg-red-500/10 text-red-300" },
  fee:     { dot: "bg-amber-500",  tag: "bg-amber-500/10 text-amber-200" },
  holiday: { dot: "bg-emerald-500",tag: "bg-emerald-500/10 text-emerald-300" },
  event:   { dot: "bg-purple-500", tag: "bg-purple-500/10 text-purple-300" },
  notice:  { dot: "bg-cw-blue",    tag: "bg-cw-blue/10 text-blue-300" },
};

export default function AnnouncementCard({ announcement, isActive, onClick }) {
  const cfg = CATEGORY_CONFIG[announcement.category] ?? CATEGORY_CONFIG.notice;

  return (
    <div
      onClick={() => onClick(announcement.id)}
      className={cn(
        "px-2.5 py-2 rounded-lg cursor-pointer transition-all",
        isActive
          ? "bg-[#161b27] border border-cw-blue/25"
          : "border border-transparent hover:bg-white/[0.02]"
      )}
    >
      {/* Top row */}
      <div className="flex items-start gap-1.5 mb-0.5">
        <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${cfg.dot}`} />
        <span className="text-[11px] font-medium text-cw-t1 flex-1 leading-snug line-clamp-2">
          {announcement.content?.slice(0, 60)}{announcement.content?.length > 60 ? '…' : ''}
        </span>
        <span className={`text-[9px] font-medium px-1.5 py-px rounded shrink-0 capitalize ${cfg.tag}`}>
          {announcement.category || 'notice'}
        </span>
      </div>

      {/* Meta */}
      <div className="text-[10px] text-cw-t3 pl-3">
        {announcement.posted_by_name || 'Faculty'} · {timeAgo(announcement.created_at)}
      </div>
    </div>
  );
}
