import { cn } from "../../utils/cn";

// Faculty only needs Post + History tabs (no chat/feed)
// Student needs Chat + Feed tabs
// Role is passed from the parent via `role` prop

const TABS_BY_ROLE = {
  student: [
    { id: 'chat',  label: 'Chat',  icon: '💬' },
    { id: 'announcements',  label: 'Feed',  icon: '📢' },
  ],
  faculty: [
    { id: 'post',    label: 'Post',    icon: '📢' },
    { id: 'history', label: 'History', icon: '📄' },
  ],
};

export default function BottomNav({ activeTab, onTabChange, role = 'student' }) {
  const tabs = TABS_BY_ROLE[role] ?? TABS_BY_ROLE.student;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-14 bg-cw-surface border-t border-white/[0.07] flex items-center z-[100]">
      {tabs.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 h-full bg-transparent border-none cursor-pointer font-dm transition-colors",
              active ? "text-cw-blue-light" : "text-cw-t3 hover:text-cw-t2"
            )}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span className="text-[10px]">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
