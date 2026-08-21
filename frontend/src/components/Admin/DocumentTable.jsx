import { useState, useEffect } from 'react';
import api from '../../services/api';
import { deleteDocument as adminDeleteDocument, retryDocument as adminRetryDocument } from '../../services/adminService';
import { cn } from '../../utils/cn';

const MIME_TO_SHORT = {
  'application/pdf': 'pdf',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'image/jpeg': 'image', 'image/jpg': 'image', 'image/png': 'image', 'image/webp': 'image',
};
const FILE_EMOJIS = { pdf:'📄', word:'📝', excel:'📊', image:'🖼' };

const STATUS_CFG = {
  completed:  { label:'✓ Ready',      cls:'bg-emerald-500/10 text-emerald-400' },
  processing: { label:'⟳ Processing', cls:'bg-amber-500/10 text-amber-300' },
  failed:     { label:'✕ Failed',     cls:'bg-red-500/10 text-red-400' },
  pending:    { label:'⏳ Pending',   cls:'bg-white/[0.06] text-cw-t3' },
};

// Mini stat card used only inside this component
function MiniStat({ label, value, accentColor }) {
  return (
    <div className="cw-card relative overflow-hidden p-3.5">
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accentColor }} />
      <div className="cw-section-header mt-1">{label}</div>
      <div className="font-outfit text-3xl font-bold text-cw-t1 mt-1 leading-none">{value}</div>
    </div>
  );
}

export default function DocumentTable({ onRefresh }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, chunks: 0, ready: 0 });
  const [deleting, setDeleting] = useState(null);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/documents', { params: { limit: 100 } });
      const list = res.data?.documents || res.data || [];
      setDocs(list);
      setStats({
        total: list.length,
        chunks: list.reduce((sum, d) => sum + (d.chunk_count || 0), 0),
        ready: list.filter(d => d.status === 'completed').length,
      });
    } catch (e) { console.error('DocumentTable:', e); setDocs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete document "${name}"? This also removes its vectors.`)) return;
    setDeleting(id);
    try {
      await adminDeleteDocument(id);
      await fetchDocs();
      onRefresh?.();
    } catch (err) {
      console.error('Admin document delete failed:', err);
      alert(err?.response?.data?.error || 'Failed to delete document');
    } finally {
      setDeleting(null);
    }
  };

  const handleRetry = async (id) => {
    try {
      await adminRetryDocument(id);
      await fetchDocs();
      onRefresh?.();
    } catch (err) {
      console.error('Admin document retry failed:', err);
      alert(err?.response?.data?.error || 'Failed to retry document');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <MiniStat label="Total Documents" value={stats.total}  accentColor="#0d9488" />
        <MiniStat label="Total Chunks"    value={stats.chunks} accentColor="#7c3aed" />
        <MiniStat label="Ready"           value={stats.ready}  accentColor="#10b981" />
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="cw-section-header">Documents</span>
        <button
          onClick={fetchDocs}
          className="px-2.5 py-1 rounded-md border border-white/[0.10] bg-white/[0.04] text-cw-t2 text-[11px] cursor-pointer hover:bg-white/[0.08] transition-colors"
        >↻ Refresh</button>
      </div>

      {/* Table */}
      <div className="cw-card overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr] px-4 py-2.5 border-b border-white/[0.07] bg-white/[0.02]">
          {['Document','Type','Status','Chunks','Actions'].map(h => (
            <div key={h} className="cw-section-header">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-cw-t3">Loading documents...</div>
        ) : docs.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-4xl mb-2">📭</div>
            <div className="text-sm text-cw-t2 mb-1">No documents uploaded yet</div>
            <div className="text-xs text-cw-t3">Faculty can upload PDF, Word, Excel and Image files from the Faculty Portal</div>
          </div>
        ) : (
          docs.map((doc, idx) => {
            const st = STATUS_CFG[doc.status] ?? STATUS_CFG.pending;
            const fileType = MIME_TO_SHORT[doc.file_type] || 'pdf';
            const emoji = FILE_EMOJIS[fileType] || '📄';
            const isDeleting = deleting === doc.id;
            return (
              <div
                key={doc.id}
                className={cn(
                  "grid grid-cols-[3fr_1fr_1fr_1fr_1fr] px-4 py-3 items-center",
                  idx < docs.length - 1 && "border-b border-white/[0.04]"
                )}
              >
                {/* Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{emoji}</span>
                  <span className="text-xs font-medium text-cw-t1 truncate">{doc.filename || doc.file_name}</span>
                </div>
                {/* Type */}
                <div className="text-[11px] text-cw-t3 uppercase">{fileType}</div>
                {/* Status */}
                <div>
                  <span className={`text-[10px] font-medium px-2 py-px rounded-full ${st.cls}`}>{st.label}</span>
                </div>
                {/* Chunks */}
                <div className="text-[11px] text-cw-t3">{doc.chunk_count || '—'}</div>
                {/* Actions */}
                <div className="flex gap-1">
                  {doc.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(doc.id)}
                      title="Retry processing"
                      className="w-6 h-6 rounded-md border border-amber-500/30 bg-amber-500/[0.08] text-amber-300 cursor-pointer flex items-center justify-center text-sm hover:bg-amber-500/20 transition-colors"
                    >↻</button>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id, doc.file_name)}
                    disabled={isDeleting}
                    title="Delete document"
                    className="w-6 h-6 rounded-md border border-red-500/25 bg-red-500/[0.06] text-red-300 cursor-pointer flex items-center justify-center text-sm hover:bg-red-500/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >{isDeleting ? '…' : '🗑'}</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
