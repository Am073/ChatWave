import { useState, useEffect } from 'react';
import api from '../../services/api';
import { retryDocument as apiRetryDocument } from '../../services/uploadService';

const FILE_EMOJIS = { pdf: '📄', word: '📝', excel: '📊', image: '🖼' };

const MIME_TO_TYPE = {
  'application/pdf': 'pdf',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'image/jpeg': 'image', 'image/jpg': 'image', 'image/png': 'image', 'image/webp': 'image',
};

const STATUS_CONFIG = {
  completed:  { label: '✓ Ready',       cls: 'bg-emerald-500/10 text-emerald-400' },
  processing: { label: '⟳ Processing',  cls: 'bg-amber-500/10 text-amber-300' },
  failed:     { label: '✕ Failed',       cls: 'bg-red-500/10 text-red-400' },
  pending:    { label: '⏳ Pending',     cls: 'bg-white/[0.06] text-cw-t3' },
};

export default function UploadedDocumentsList({ refreshTrigger }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const fetchDocs = async () => {
    try {
      // FIX[5]: Aligned with FastAPI route GET /api/upload
      const res = await api.get('/upload');
      setDocs(res.data?.documents || res.data || []);
    } catch { setDocs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDocs(); }, [refreshTrigger]);

  const handleDelete = async (docId, name) => {
    if (!window.confirm(`Delete "${name}"?\n\nThis will remove it from the knowledge base permanently.`)) return;
    setDeleting(docId);
    try {
      await api.delete(`/upload/${docId}`);
      setDocs(prev => prev.filter(d => (d._id || d.id) !== docId));
    } catch (err) { alert(err.response?.data?.message || err.response?.data?.error || 'Delete failed'); }
    finally { setDeleting(null); }
  };

  // FIX[5]: Backend now exposes POST /upload/{id}/retry
  const handleRetry = async (docId) => {
    try {
      await apiRetryDocument(docId);
      await fetchDocs();
    } catch (err) {
      alert(err?.response?.data?.error || 'Retry failed');
    }
  };

  if (loading) return (
    <div className="py-3 text-center text-[11px] text-cw-t3">Loading documents...</div>
  );

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="cw-section-header">
          Uploaded Documents{docs.length > 0 && ` (${docs.length})`}
        </span>
        <button
          onClick={fetchDocs}
          className="bg-transparent border-none text-cw-t3 hover:text-cw-t2 cursor-pointer text-sm px-1.5 py-0.5 rounded transition-colors"
          title="Refresh list"
        >↻</button>
      </div>

      {docs.length === 0 ? (
        <div className="py-5 text-center rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="text-xl mb-1.5">📭</div>
          <div className="text-[11px] text-cw-t3">No documents uploaded yet</div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {docs.map(doc => {
            const docId = doc._id || doc.id;
            const fileType = MIME_TO_TYPE[doc.file_type] || 'pdf';
            const emoji = FILE_EMOJIS[fileType] || '📄';
            const status = doc.status || doc.processing_status || 'pending';
            const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
            const isDeleting = deleting === docId;

            return (
              <div key={docId} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.025] border border-white/[0.07] transition-colors hover:bg-white/[0.035]">
                <span className="text-lg shrink-0">{emoji}</span>

                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-cw-t1 truncate mb-0.5">{doc.filename || doc.file_name}</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[9px] font-medium px-1.5 py-px rounded-full ${cfg.cls}`}>{cfg.label}</span>
                    {doc.chunk_count > 0 && <span className="text-[10px] text-cw-t3">{doc.chunk_count} chunks</span>}
                    {(doc.createdAt || doc.uploaded_at) && <span className="text-[10px] text-cw-t3">{new Date(doc.createdAt || doc.uploaded_at).toLocaleDateString()}</span>}
                  </div>
                </div>

                <div className="flex gap-1 shrink-0">
                  {status === 'failed' && (
                    <button
                      onClick={() => handleRetry(docId)}
                      title="Retry processing"
                      className="w-6 h-6 rounded-md border border-amber-500/30 bg-amber-500/[0.08] text-amber-300 cursor-pointer flex items-center justify-center text-sm hover:bg-amber-500/20 transition-colors"
                    >↻</button>
                  )}
                  <button
                    onClick={() => handleDelete(docId, doc.filename || doc.file_name)}
                    disabled={isDeleting}
                    title="Delete document"
                    className="w-6 h-6 rounded-md border border-red-500/25 bg-red-500/[0.06] text-red-300 cursor-pointer flex items-center justify-center text-sm hover:bg-red-500/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? '…' : '🗑'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
