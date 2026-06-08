import { timeAgo } from "../../utils/dateHelpers";

const TYPE_DOT = {
  document_upload: "bg-cw-blue",
  user_registered: "bg-emerald-400",
  announcement:    "bg-amber-400",
  error:           "bg-red-400",
};

export default function ActivityFeed({ activities = [], loading }) {
  return (
    <div className="cw-card overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
        <h3 className="cw-section-header">Recent Activity</h3>
      </div>

      <div className="p-2.5 flex flex-col gap-0.5 max-h-[320px] overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="py-10 text-center flex flex-col items-center gap-2">
            <span className="text-2xl opacity-50">📭</span>
            <span className="text-xs text-cw-t3 italic">Loading activity...</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-10 text-center flex flex-col items-center gap-2">
            <span className="text-2xl opacity-50">📭</span>
            <span className="text-xs text-cw-t3 italic">No recent activity found</span>
          </div>
        ) : (
          activities.map((act, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 p-2.5 rounded-lg border border-transparent hover:bg-white/[0.03] hover:border-white/[0.08] transition-all cursor-default"
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${TYPE_DOT[act.type] ?? 'bg-cw-t3'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-cw-t1 truncate">{act.title}</div>
                <div className="text-[10px] text-cw-t3 mt-0.5">{act.meta}</div>
              </div>
              <div className="text-[10px] text-cw-t3 shrink-0 mt-0.5">
                {act.time_ago || timeAgo(act.created_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
