import { useDocumentStatus } from '../../hooks/useDocumentStatus';

const FILE_EMOJIS = { pdf: '📄', word: '📝', excel: '📊', image: '🖼' };

const STATUS_CONFIG = {
  pending: {
    label: 'Queued',
    labelCls: 'text-cw-t3',
    barCls: 'bg-cw-t3',
    barWidth: '10%',
    animated: false,
  },
  processing: {
    label: 'Processing...',
    labelCls: 'text-amber-400',
    barCls: 'bg-amber-400',
    barWidth: '70%',
    animated: true,
  },
  completed: {
    label: null, // built dynamically
    labelCls: 'text-emerald-400',
    barCls: 'bg-emerald-400',
    barWidth: '100%',
    animated: false,
  },
  failed: {
    label: '✕ Failed',
    labelCls: 'text-red-400',
    barCls: 'bg-red-400',
    barWidth: '100%',
    animated: false,
  },
};

export default function ProcessingStatus({ documentId, fileName, fileType, onComplete }) {
  const { status, chunkCount, error } = useDocumentStatus(documentId, onComplete);
  const emoji = FILE_EMOJIS[fileType?.toLowerCase()] || '📄';
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const label = status === 'completed'
    ? (chunkCount ? `✓ Ready · ${chunkCount} chunks` : '✓ Ready')
    : cfg.label;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
      <span className="text-lg shrink-0">{emoji}</span>

      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-cw-t1 truncate mb-1.5">{fileName}</div>

        {/* Progress bar — width must be inline */}
        <div className="h-0.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${cfg.barCls} ${cfg.animated ? 'animate-pulse' : ''}`}
            style={{ width: cfg.barWidth }}
          />
        </div>

        {error && status === 'failed' && (
          <div className="text-[10px] text-red-300 mt-1">{error}</div>
        )}
      </div>

      <span className={`text-[10px] font-medium shrink-0 whitespace-nowrap ${cfg.labelCls}`}>
        {label}
      </span>
    </div>
  );
}
