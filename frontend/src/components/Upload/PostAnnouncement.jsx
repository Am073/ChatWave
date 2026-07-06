import React, { useState, useEffect } from "react";
import { postAnnouncement, getAnnouncements } from "../../services/announcementService";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { timeAgo } from "../../utils/dateHelpers";
import { cn } from "../../utils/cn";

const CATEGORIES = [
  { value: 'notice',  label: 'Notice',  cls: 'border-cw-blue/60   bg-cw-blue/15   text-blue-300' },
  { value: 'exam',    label: 'Exam',    cls: 'border-red-500/60   bg-red-500/15   text-red-300' },
  { value: 'fee',     label: 'Fee',     cls: 'border-amber-500/60 bg-amber-500/15 text-amber-300' },
  { value: 'holiday', label: 'Holiday', cls: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300' },
  { value: 'event',   label: 'Event',   cls: 'border-purple-500/60 bg-purple-500/15 text-purple-300' },
];

const CAT_TAG = {
  notice:  'bg-cw-blue/10 text-blue-300',
  exam:    'bg-red-500/10 text-red-300',
  fee:     'bg-amber-500/10 text-amber-200',
  holiday: 'bg-emerald-500/10 text-emerald-300',
  event:   'bg-purple-500/10 text-purple-300',
};

export default function PostAnnouncement({ showOnlyMine = true, onPostSuccess }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");  // FIX[6]: title field required by backend
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("notice");
  const [loading, setLoading] = useState(false);
  const [recentPosts, setRecentPosts] = useState([]);

  const fetchRecent = async () => {
    try {
      const res = await getAnnouncements();
      const posts = Array.isArray(res.data) ? res.data : (res.data?.announcements || []);
      const filtered = showOnlyMine
        ? posts.filter(p => (p.author?._id || p.author?.id || p.author) === user?.id)
        : posts;
      const postMap = new Map();
      filtered.forEach(p => { if (!postMap.has(p.id || p._id)) postMap.set(p.id || p._id, { ...p, id: p.id || p._id }); });
      setRecentPosts(Array.from(postMap.values()).slice(0, 5));
    } catch { setRecentPosts([]); }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/announcements/${postId}`);
      setRecentPosts(prev => prev.filter(p => p.id !== postId && p._id !== postId));
    } catch { alert('Could not delete announcement'); }
  };

  useEffect(() => { fetchRecent(); }, [showOnlyMine, user?.id]);

  const handlePost = async () => {
    // FIX[6]: Validate title is non-empty
    if (!title.trim()) { alert('Please enter a title'); return; }
    if (!content.trim()) { alert('Please write an announcement'); return; }
    setLoading(true);
    try {
      if (!user) { alert('Not logged in'); return; }
      // FIX[6]: Include title in the payload
      await postAnnouncement({
        title: title.trim(),
        content: content.trim(),
        category,
        is_private: false
      });
      setTitle(''); setContent(''); setCategory('notice');
      await fetchRecent();
      onPostSuccess?.();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to post announcement.';
      alert(errorMsg);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Category selector */}
      <div>
        <div className="cw-section-header mb-2">Announcement type</div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-dm font-medium cursor-pointer border transition-all",
                category === cat.value
                  ? cat.cls
                  : "border-white/10 bg-transparent text-cw-t3 hover:text-cw-t2"
              )}
            >{cat.label}</button>
          ))}
        </div>
      </div>

      {/* FIX[6]: Title input */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Announcement title (required)"
        className="cw-input text-xs"
        maxLength={200}
      />

      {/* Text area */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Type your announcement..."
        className="cw-input min-h-[80px] text-xs resize-none"
      />

      {/* Post button */}
      <button
        onClick={handlePost}
        disabled={loading || !content.trim() || !title.trim()}
        className="w-full py-2 rounded-xl border-none bg-cw-teal text-white text-xs font-dm font-medium cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Posting..." : "Post Announcement"}
      </button>

      {/* Recent posts */}
      <div className="border-t border-white/[0.07] pt-3 mt-1">
        <div className="cw-section-header mb-2">Recent Posts</div>

        {recentPosts.length === 0 ? (
          <div className="text-center py-4 text-[11px] text-cw-t3">No announcements posted yet</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {recentPosts.map(post => (
              <div key={post.id} className="relative px-3 py-2 rounded-lg bg-white/[0.025] border border-white/[0.06]">
                <button
                  onClick={() => handleDeletePost(post.id)}
                  className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center text-[11px] text-cw-t3 hover:bg-red-500/10 hover:text-red-300 transition-all cursor-pointer bg-transparent border-none"
                >✕</button>
                <div className="text-xs text-cw-t1 line-clamp-1 pr-6 mb-1.5">{post.content}</div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-medium px-1.5 py-px rounded-full capitalize ${CAT_TAG[post.category] ?? CAT_TAG.notice}`}>
                    {post.category || 'notice'}
                  </span>
                  <span className="text-[10px] text-cw-t3">College-wide · {timeAgo(post.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
