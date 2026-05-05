// Format relative time
export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60)      return 'just now'
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

// Format file size
export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024**2)    return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/1024**2).toFixed(1)} MB`
}

// Truncate text
export function truncate(str, n = 80) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

// Confidence to label
export function confidenceLabel(score) {
  if (!score) return null
  if (score >= 0.8) return { label: 'High',   cls: 'badge-green' }
  if (score >= 0.5) return { label: 'Medium', cls: 'badge-amber' }
  return              { label: 'Low',    cls: 'badge-red'   }
}

// Similarity to color style
export function simColor(sim) {
  if (sim >= 0.75) return 'var(--green)'
  if (sim >= 0.5)  return 'var(--amber)'
  return 'var(--text-muted)'
}

// Clamp number
export function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max)
}
