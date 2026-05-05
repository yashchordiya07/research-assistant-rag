import React from 'react'
import { useAppStore } from '../../stores/appStore.js'

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore()

  if (!toasts.length) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999, pointerEvents: 'none',
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="fade-in"
          style={{
            pointerEvents: 'auto',
            background: t.type === 'error' ? 'var(--red-bg)' :
                        t.type === 'success' ? 'var(--green-bg)' : 'var(--bg-overlay)',
            border: `1px solid ${
              t.type === 'error' ? 'rgba(248,113,113,0.3)' :
              t.type === 'success' ? 'rgba(52,211,153,0.3)' : 'var(--border-default)'
            }`,
            color: t.type === 'error' ? 'var(--red)' :
                   t.type === 'success' ? 'var(--green)' : 'var(--text-primary)',
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            fontSize: 13,
            maxWidth: 340,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <span>{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: 0, fontSize: 14 }}
          >×</button>
        </div>
      ))}
    </div>
  )
}
