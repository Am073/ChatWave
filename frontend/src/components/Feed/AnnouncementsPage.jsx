import { useState } from 'react';
import { timeAgo } from '../../utils/dateHelpers';
import { cn } from '../../utils/cn';

const CATEGORY_STYLES = {
  exam: {
    dot: 'bg-red-500',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    border: 'border-red-500/20',
  },
  fee: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    border: 'border-amber-500/20',
  },
  holiday: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    border: 'border-emerald-500/20',
  },
  event: {
    dot: 'bg-purple-500',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    border: 'border-purple-500/20',
  },
  notice: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    border: 'border-blue-500/20',
  },
};

export default function AnnouncementsPage({
  announcements = [],
  unreadCount = 0,
  onMarkRead,
  onRefresh,
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const CATEGORIES = ['all', 'notice', 'exam', 'fee', 'holiday', 'event'];

  const filtered = announcements.filter(a => {
    const matchCat = filter === 'all' || a.category === filter;
    const matchSearch = !search || a.content?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleCardClick = (ann) => {
    setExpandedId(expandedId === ann.id ? null : ann.id);
    if (onMarkRead) onMarkRead(ann.id);
  };

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto bg-cw-black p-6">

      {/* Page header */}
      <div className="w-full max-w-2xl mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-outfit text-xl font-bold text-cw-t1">
            Announcements
          </h1>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30">
                {unreadCount} unread
              </span>
            )}
            <button onClick={onRefresh} className="cw-btn-secondary">
              ↻ Refresh
            </button>
          </div>
        </div>
        <p className="text-xs text-cw-t3">
          Official announcements from your college faculty and administration
        </p>
      </div>

      {/* Search + filter */}
      <div className="w-full max-w-2xl flex flex-col gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search announcements..."
          className="cw-input"
        />
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full',
                'text-[11px] font-dm font-medium',
                'cursor-pointer transition-all',
                'duration-150 border',
                filter === cat
                  ? 'bg-cw-blue/15 border-cw-blue/50 text-blue-300'
                  : 'bg-transparent border-white/[0.1] text-cw-t3 hover:text-cw-t2 hover:border-white/20'
              )}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="w-full max-w-2xl mb-3">
        <span className="text-[11px] text-cw-t3">
          {filtered.length} announcement{filtered.length !== 1 ? 's' : ''}
          {filter !== 'all' ? ` in ${filter}` : ''}
        </span>
      </div>

      {/* Announcement cards */}
      <div className="w-full max-w-2xl flex flex-col gap-3">

        {filtered.length === 0 ? (
          <div className="cw-card p-12 text-center flex flex-col items-center gap-3">
            <span className="text-4xl">📭</span>
            <p className="text-sm text-cw-t3">
              {search || filter !== 'all'
                ? 'No announcements match your search'
                : 'No announcements yet'}
            </p>
            {(search || filter !== 'all') && (
              <button
                onClick={() => { setSearch(''); setFilter('all'); }}
                className="cw-btn-secondary mt-1"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filtered.map(ann => {
            const cfg = CATEGORY_STYLES[ann.category] || CATEGORY_STYLES.notice;
            const isExpanded = expandedId === ann.id;
            const isUnread = !ann.is_read;

            return (
              <div
                key={ann.id}
                onClick={() => handleCardClick(ann)}
                className={cn(
                  'cw-card p-5 cursor-pointer',
                  'transition-all duration-200',
                  'hover:bg-white/[0.03]',
                  isUnread ? 'border-l-2 ' + cfg.border : '',
                  isExpanded ? 'bg-cw-card/80' : ''
                )}
              >
                {/* Card header */}
                <div className="flex items-start gap-3">
                  {/* Category dot */}
                  <div className={cn('w-2.5 h-2.5 rounded-full mt-1.5 shrink-0', cfg.dot)} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">

                    {/* Category + unread */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn('cw-badge border text-[9px]', cfg.badge)}>
                        {ann.category || 'notice'}
                      </span>
                      {isUnread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cw-blue-light shrink-0" />
                      )}
                    </div>

                    {/* Announcement text */}
                    <p className={cn(
                      'text-[13px] text-cw-t1 leading-relaxed',
                      !isExpanded ? 'line-clamp-2' : ''
                    )}>
                      {ann.content}
                    </p>

                    {/* Show more hint */}
                    {!isExpanded && ann.content?.length > 120 && (
                      <span className="text-[11px] text-cw-blue-light mt-1 inline-block">
                        Click to read more
                      </span>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="text-[10px] text-cw-t3">
                        Posted by <span className="text-cw-t2 font-medium">{ann.author_name || ann.posted_by_name || 'Faculty'}</span>
                      </span>
                      <span className="text-[10px] text-cw-t3">·</span>
                      <span className="text-[10px] text-cw-t3">{timeAgo(ann.created_at)}</span>
                      <span className="text-[10px] text-cw-t3">·</span>
                      <span className="text-[10px] text-cw-t3 capitalize">
                        {ann.scope?.replace('_', ' ') || 'College-wide'}
                      </span>
                    </div>
                  </div>

                  {/* Expand arrow */}
                  <span className={cn(
                    'text-cw-t3 text-sm shrink-0 transition-transform duration-200',
                    isExpanded ? 'rotate-180' : ''
                  )}>
                    ▾
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom padding for scroll */}
      <div className="h-8" />
    </div>
  );
}
