export function timeAgo(dateString) {
  if (!dateString) return '';
  const diff = Date.now() -
    new Date(dateString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}
export function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString)
    .toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short',
      year: 'numeric'
    });
}
export function formatDateTime(dateString) {
  if (!dateString) return '';
  return new Date(dateString)
    .toLocaleString('en-IN', {
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit'
    });
}
