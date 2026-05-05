import React, { useState } from 'react'
import { useAppStore } from '../../stores/appStore.js'
import { conversationsApi } from '../../services/api.js'
import { timeAgo, truncate } from '../../utils/helpers.js'

const NAV_ITEMS = [
  { id: 'chat',      icon: ChatIcon,     label: 'Chat' },
  { id: 'documents', icon: DocIcon,      label: 'Documents' },
  { id: 'search',    icon: SearchIcon,   label: 'Search' },
  { id: 'system',    icon: StatusIcon,   label: 'System' },
]

export default function Sidebar({ onReloadConversations }) {
  const {
    activeView, setActiveView,
    conversations, activeConversationId,
    setActiveConversationId, setMessages,
    addToast, systemStatus,
  } = useAppStore()

  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')

  const newChat = async () => {
    try {
      const conv = await conversationsApi.create('New Chat')
      await onReloadConversations()
      setActiveConversationId(conv.id)
      setMessages([])
      setActiveView('chat')
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const deleteConv = async (e, id) => {
    e.stopPropagation()
    try {
      await conversationsApi.delete(id)
      await onReloadConversations()
      if (activeConversationId === id) {
        setActiveConversationId(null)
        setMessages([])
      }
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const startRename = (e, conv) => {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditTitle(conv.title)
  }

  const commitRename = async (id) => {
    if (!editTitle.trim()) return
    try {
      await conversationsApi.rename(id, editTitle.trim())
      await onReloadConversations()
    } catch (_) {}
    setEditingId(null)
  }

  const ollamaOk = systemStatus?.ollama === 'ok'

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      minWidth: 'var(--sidebar-w)',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent-1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>⬡</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>
              Research<span style={{ color: 'var(--text-accent)' }}>AI</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              local · rag · assistant
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '10px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
          const active = activeView === id
          return (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 10px', borderRadius: 'var(--r-sm)',
                background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
                color: active ? 'var(--text-accent)' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer', fontSize: 13,
                fontFamily: 'var(--font-body)', fontWeight: active ? 500 : 400,
                transition: 'all 0.15s', marginBottom: 2,
                borderLeft: active ? '2px solid var(--accent-1)' : '2px solid transparent',
              }}
            >
              <Icon size={15} />
              {label}
              {id === 'documents' && systemStatus && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {systemStatus.document_count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* New chat button */}
      <div style={{ padding: '10px 10px 6px' }}>
        <button
          className="btn btn-primary"
          onClick={newChat}
          style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
        >
          <span>+</span> New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 12px 4px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Conversations
        </div>
        <div className="scroll-y" style={{ flex: 1, padding: '0 6px 6px' }}>
          {conversations.length === 0 ? (
            <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => {
              const active = conv.id === activeConversationId
              return (
                <div
                  key={conv.id}
                  onClick={() => { setActiveConversationId(conv.id); setActiveView('chat') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 8px', borderRadius: 'var(--r-sm)',
                    background: active ? 'var(--bg-overlay)' : 'transparent',
                    border: `1px solid ${active ? 'var(--border-default)' : 'transparent'}`,
                    cursor: 'pointer', marginBottom: 1,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  {editingId === conv.id ? (
                    <input
                      autoFocus
                      className="input"
                      value={editTitle}
                      style={{ fontSize: 12, padding: '2px 6px', flex: 1 }}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => commitRename(conv.id)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(conv.id); if (e.key === 'Escape') setEditingId(null) }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span style={{ fontSize: 13, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {truncate(conv.title, 28)}
                      </span>
                      <div style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s' }}
                        className="conv-actions"
                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                        onMouseLeave={e => e.currentTarget.style.opacity = 0}
                      >
                        <button className="btn-icon" style={{ width: 20, height: 20 }} onClick={e => startRename(e, conv)} title="Rename">
                          <PenIcon size={11} />
                        </button>
                        <button className="btn-icon" style={{ width: 20, height: 20, color: 'var(--red)' }} onClick={e => deleteConv(e, conv.id)} title="Delete">
                          <TrashIcon size={11} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Footer status */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
      }}>
        <span className={`pulse`} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: ollamaOk ? 'var(--green)' : 'var(--red)',
          flexShrink: 0,
        }} />
        Ollama {ollamaOk ? 'connected' : 'offline'}
      </div>
    </aside>
  )
}

// ── Inline SVG icons ──────────────────────────────────────────────────────
function ChatIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14 9.667A1.333 1.333 0 0 1 12.667 11H4.667L2 13.667V3.333A1.333 1.333 0 0 1 3.333 2H12.667A1.333 1.333 0 0 1 14 3.333V9.667Z" strokeLinejoin="round"/>
  </svg>
}
function DocIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9.333 1.333H4a1.333 1.333 0 0 0-1.333 1.334v10.666A1.333 1.333 0 0 0 4 14.667h8a1.333 1.333 0 0 0 1.333-1.334V5.333L9.333 1.333Z" strokeLinejoin="round"/>
    <path d="M9.333 1.333v4H13.333" strokeLinecap="round"/>
    <path d="M5.333 8.667h5.334M5.333 11.333h3.334" strokeLinecap="round"/>
  </svg>
}
function SearchIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="7" cy="7" r="4.5"/><path d="M13.5 13.5l-3-3" strokeLinecap="round"/>
  </svg>
}
function StatusIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 1.333A6.667 6.667 0 1 1 8 14.667A6.667 6.667 0 0 1 8 1.333Z"/>
    <path d="M8 5.333v2.667l1.667 1.667" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
}
function PenIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M11.333 2a1.886 1.886 0 0 1 2.667 2.667L5.333 13.333l-3.333.667.667-3.333L11.333 2Z" strokeLinejoin="round"/>
  </svg>
}
function TrashIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 4h12M5.333 4V2.667h5.334V4M12.667 4l-.667 9.333H4L3.333 4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
}
