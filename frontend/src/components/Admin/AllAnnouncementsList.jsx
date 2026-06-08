import { useState, useEffect } from 'react';
import api from '../../services/api';
import { timeAgo } from '../../utils/dateHelpers';
import { cn } from '../../utils/cn';

const CATEGORY_STYLES = {
  exam: {
    dot: 'bg-red-500',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  fee: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  holiday: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  event: {
    dot: 'bg-purple-500',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  notice: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
};

export default function AllAnnouncementsList({ refreshTrigger }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await api.get('/announcements/', { params: { limit: 100 } });
      const data = res.data?.announcements || res.data || [];
      setAnnouncements(data);
    } catch (e) {
      console.error('Fetch announcements:', e);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [refreshTrigger]);

  const handleDelete = async (id, content) => {
    const preview = content?.slice(0, 50) + (content?.length > 50 ? '...' : '');
    if (!window.confirm(`Delete this announcement?\n"${preview}"`)) return;

    setDeleting(id);
    try {
      await api.delete(`/announcements/${id}`);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      alert(e.response?.data?.detail || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const CATEGORIES = ['all', 'notice', 'exam', 'fee', 'holiday', 'event'];

  const filtered = announcements.filter(a => {
    const matchCat = filter === 'all' || a.category === filter;
    const matchSearch = !search ||
      a.content?.toLowerCase().includes(search.toLowerCase()) ||
      a.posted_by_name?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-outfit text-sm font-semibold text-cw-t1">
            All Announcements
          </h3>
          <p className="text-[11px] text-cw-t3 mt-0.5">
            All announcements posted in your college
          </p>
        </div>
        <button onClick={fetchAll} className="cw-btn-secondary">
          ↻ Refresh
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search announcements..."
          className="cw-input flex-1 min-w-[200px]"
        />
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[11px]',
                'font-dm font-medium cursor-pointer',
                'transition-all duration-150 border',
                filter === cat
                  ? 'bg-cw-blue/15 border-cw-blue/50 text-blue-300'
                  : 'bg-transparent border-white/[0.1] text-cw-t3 hover:text-cw-t2'
              )}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="text-[11px] text-cw-t3">
        {loading ? 'Loading...' : `${filtered.length} announcement${filtered.length !== 1 ? 's' : ''} found`}
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="cw-card p-8 text-center text-cw-t3 text-sm">
            Loading announcements...
          </div>
        ) : filtered.length === 0 ? (
          <div className="cw-card p-8 text-center">
            <div className="text-3xl mb-2">📭</div>
            <div className="text-sm text-cw-t3">
              {search || filter !== 'all'
                ? 'No announcements match your filter'
                : 'No announcements posted yet'}
            </div>
          </div>
        ) : (
          filtered.map(ann => {
            const cfg = CATEGORY_STYLES[ann.category] || CATEGORY_STYLES.notice;
            return (
              <div
                key={ann.id}
                className="cw-card p-4 flex items-start gap-3 group hover:bg-white/[0.02] transition-all"
              >
                {/* Category dot */}
                <div className={cn('w-2 h-2 rounded-full shrink-0 mt-1.5', cfg.dot)} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-cw-t1 leading-relaxed mb-2">
                    {ann.content}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('cw-badge border text-[9px]', cfg.badge)}>
                      {ann.category || 'notice'}
                    </span>
                    <span className="text-[10px] text-cw-t3">
                      Posted by <span className="text-cw-t2">{ann.author_name || ann.posted_by_name || 'Faculty'}</span>
                    </span>
                    <span className="text-[10px] text-cw-t3">·</span>
                    <span className="text-[10px] text-cw-t3">{timeAgo(ann.created_at)}</span>
                    <span className="text-[10px] text-cw-t3">·</span>
                    <span className="text-[10px] text-cw-t3 capitalize">{ann.scope || 'College-wide'}</span>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(ann.id, ann.content)}
                  disabled={deleting === ann.id}
                  title="Delete announcement"
                  className={cn(
                    'w-7 h-7 rounded-lg shrink-0',
                    'border border-red-500/25',
                    'bg-red-500/[0.06] text-red-300',
                    'flex items-center justify-center',
                    'text-xs transition-all',
                    'opacity-0 group-hover:opacity-100',
                    deleting === ann.id
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer hover:bg-red-500/15'
                  )}
                >
                  {deleting === ann.id ? '...' : '🗑'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
