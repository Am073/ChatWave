import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { uploadDocument } from '../../services/uploadService';
import ProcessingStatus from './ProcessingStatus';
import { cn } from '../../utils/cn';

const ALLOWED_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'image/jpeg': 'image', 'image/jpg': 'image', 'image/png': 'image',
};
const FILE_EMOJIS = { pdf: '📄', word: '📝', excel: '📊', image: '🖼' };
const TYPE_PILLS = [
  { label: 'PDF',   cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  { label: 'Word',  cls: 'bg-cw-blue/10 text-blue-400 border-cw-blue/20' },
  { label: 'Excel', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { label: 'Image', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
];

export default function DocumentUpload({ onUploadComplete }) {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [processingItems, setProcessingItems] = useState([]);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (!ALLOWED_TYPES[file.type]) return 'Unsupported file type. Use PDF, Word, Excel, or Image.';
    if (file.size / (1024 * 1024) > 50) return `File too large. Max 50 MB.`;
    return null;
  };

  const handleFilesChosen = (files) => {
    setError('');
    const validFiles = [], errors = [];
    files.forEach(file => {
      const err = validateFile(file);
      if (err) errors.push(`${file.name}: ${err}`);
      else validFiles.push({ file, type: ALLOWED_TYPES[file.type], id: `preview-${Date.now()}-${Math.random()}` });
    });
    if (errors.length) setError(errors.join('\n'));
    if (validFiles.length) setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (idx) => setSelectedFiles(prev => prev.filter((_, i) => i !== idx));

  const removeProcessingItem = (id) =>
    setProcessingItems(prev => prev.filter(item => item.id !== id));

  const handleUpload = async () => {
    if (!selectedFiles.length || uploading) return;
    setUploading(true); setError('');
    const newItems = [], errors = [];
    for (const item of selectedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('scope', 'college_wide');
        formData.append('college_name', user.college_name);
        formData.append('uploaded_by', user.id || user._id);
        const res = await uploadDocument(formData);
        const docId = res.data?.documentId;
        if (docId) newItems.push({ id: docId, name: item.file.name, type: item.type });
      } catch (err) {
        errors.push(`${item.file.name}: ${err.response?.data?.error || err.response?.data?.detail || 'Upload failed'}`);
      }
    }
    if (newItems.length) {
      setProcessingItems(prev => [...prev, ...newItems]);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onUploadComplete) onUploadComplete();
    }
    if (errors.length) setError(errors.join('\n'));
    setUploading(false);
  };

  const count = selectedFiles.length;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault(); setIsDragging(false);
          const files = Array.from(e.dataTransfer.files || []);
          if (files.length) handleFilesChosen(files);
        }}
        className={cn(
          "rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all",
          count > 0
            ? "border border-emerald-500/50 bg-emerald-500/[0.04]"
            : isDragging
              ? "border border-cw-blue/70 bg-cw-blue/[0.08]"
              : "border border-dashed border-cw-blue/30 bg-cw-blue/[0.03] hover:border-cw-blue/50"
        )}
      >
        {count > 0 ? (
          <div className="w-full">
            <div className="text-[11px] text-emerald-400 font-medium mb-2">
              {count} file{count > 1 ? 's' : ''} selected
            </div>
            {selectedFiles.map((item, idx) => (
              <div key={item.id} className={cn(
                "flex items-center gap-2 py-1.5",
                idx < count - 1 && "border-b border-white/[0.06]"
              )}>
                <span className="text-base">{FILE_EMOJIS[item.type] || '📄'}</span>
                <span className="flex-1 text-[11px] text-cw-t1 truncate">{item.file.name}</span>
                <span className="text-[10px] text-cw-t3 shrink-0">
                  {(item.file.size / (1024 * 1024)).toFixed(1)}MB
                </span>
                <button
                  onClick={e => { e.stopPropagation(); removeFile(idx); }}
                  className="w-4 h-4 rounded-full border border-red-500/40 bg-red-500/10 text-red-300 flex items-center justify-center text-[9px] cursor-pointer shrink-0 hover:bg-red-500/20 transition-colors"
                >✕</button>
              </div>
            ))}
            <div className="mt-2 text-[10px] text-cw-t3 text-center">Click to add more files</div>
          </div>
        ) : (
          <>
            <div className="w-10 h-10 rounded-xl bg-cw-blue/10 flex items-center justify-center text-lg">⬆</div>
            <div className="text-sm text-cw-t2 text-center">Drop files here or click to browse</div>
            <div className="text-[11px] text-cw-t3 text-center">Max 50 MB per file</div>
          </>
        )}
      </div>

      {/* Type pills */}
      <div className="flex gap-1.5 flex-wrap justify-center">
        {TYPE_PILLS.map(({ label, cls }) => (
          <span key={label} className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>
            {label}
          </span>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/[0.08] border border-red-500/25 text-red-300 text-xs whitespace-pre-line">
          ⚠ {error}
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={count === 0 || uploading}
        className="w-full py-2.5 rounded-xl border-none font-dm text-xs font-medium cursor-pointer transition-all bg-gradient-to-r from-blue-800 to-cw-blue text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:from-cw-card disabled:to-cw-card disabled:text-cw-t3"
      >
        {uploading
          ? `⟳ Uploading ${count} file${count > 1 ? 's' : ''}…`
          : count > 0
            ? `⬆ Upload ${count} file${count > 1 ? 's' : ''}`
            : '⬆ Select files to upload'}
      </button>

      <input ref={fileInputRef} type="file" multiple className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,image/jpeg,image/png,image/jpg"
        onChange={e => {
          const files = Array.from(e.target.files || []);
          if (files.length) handleFilesChosen(files);
          e.target.value = '';
        }}
      />

      {/* Processing queue */}
      {processingItems.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="flex items-center justify-between">
            <span className="cw-section-header">
              Processing queue
            </span>
            <button
              onClick={() => setProcessingItems([])}
              className="text-[10px] text-cw-t3 hover:text-red-400 transition-colors cursor-pointer"
            >
              Clear all
            </button>
          </div>
          {processingItems.map(item => (
            <div key={item.id} className="relative group">
              <ProcessingStatus
                documentId={item.id}
                fileName={item.name}
                fileType={item.type}
                onComplete={onUploadComplete}
              />
              <button
                onClick={() => removeProcessingItem(item.id)}
                className="absolute top-2 right-2 w-5 h-5 rounded-full border border-white/10 bg-cw-card text-cw-t3 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 flex items-center justify-center text-[10px] cursor-pointer transition-all opacity-0 group-hover:opacity-100 z-10"
                title="Remove from queue"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
