import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAppStore } from '../../stores/appStore.js'
import { chatApi, conversationsApi } from '../../services/api.js'
import { useMessages } from '../../hooks/useData.js'
import { timeAgo, confidenceLabel, simColor, truncate } from '../../utils/helpers.js'

export default function ChatView({ onReloadConversations }) {
  const {
    activeConversationId, conversations,
    messages, messagesLoading,
    chatSending, setChatSending,
    addMessage, updateLastAssistantMessage,
    addToast, useRag, topK, setUseRag, setTopK,
  } = useAppStore()

  const [input, setInput] = useState('')
  const [expandedSources, setExpandedSources] = useState(new Set())
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const { reload: reloadMessages } = useMessages(activeConversationId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatSending])

  const activeConv = conversations.find(c => c.id === activeConversationId)

  const send = async () => {
    const text = input.trim()
    if (!text || !activeConversationId || chatSending) return

    setInput('')
    setChatSending(true)

    // Optimistic user message
    addMessage({ id: Date.now(), role: 'user', content: text, created_at: new Date().toISOString() })
    // Placeholder assistant
    addMessage({ id: Date.now() + 1, role: 'assistant', content: '', created_at: new Date().toISOString(), _pending: true })

    try {
      const resp = await chatApi.send(activeConversationId, text, useRag, topK)
      updateLastAssistantMessage(resp.message.content, {
        sources: resp.sources,
        confidence: resp.message.confidence,
        rag_used: resp.rag_used,
        model: resp.message.model,
        _pending: false,
        id: resp.message.id,
      })
      // Auto-rename first message
      if (messages.filter(m => m.role === 'user').length === 0) {
        try {
          const title = text.slice(0, 40)
          await conversationsApi.rename(activeConversationId, title)
          await onReloadConversations()
        } catch (_) {}
      }
    } catch (e) {
      updateLastAssistantMessage(`Error: ${e.message}`, { _pending: false, _error: true })
      addToast(e.message, 'error')
    } finally {
      setChatSending(false)
      inputRef.current?.focus()
    }
  }

  const toggleSources = (msgId) => {
    setExpandedSources(prev => {
      const next = new Set(prev)
      next.has(msgId) ? next.delete(msgId) : next.add(msgId)
      return next
    })
  }

  if (!activeConversationId) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>⬡</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            Research<span style={{ color: 'var(--text-accent)' }}>AI</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 320, lineHeight: 1.6 }}>
            A local RAG assistant. Upload documents, generate embeddings, then ask questions grounded in your sources.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 400, width: '100%' }}>
          {[
            ['📄', 'Upload docs', 'Add PDFs or plain text'],
            ['⚡', 'Embed', 'Generate vector embeddings'],
            ['🔍', 'Search', 'Semantic similarity search'],
            ['💬', 'Chat', 'Ask questions with sources'],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
            </div>
          ))}
        </div>
        <NewChatButton onReloadConversations={onReloadConversations} />
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '0 20px',
        height: 'var(--header-h)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
            {activeConv?.title || 'Chat'}
          </span>
          {activeConv && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {activeConv.message_count} messages
            </span>
          )}
        </div>
        <RagToggle useRag={useRag} setUseRag={setUseRag} topK={topK} setTopK={setTopK} />
      </div>

      {/* Messages */}
      <div className="scroll-y" style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {messagesLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <div className="icon">💬</div>
            <h3>Start the conversation</h3>
            <p>Ask anything. If you've added documents, I'll ground answers in your sources.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={msg.id || i}
              msg={msg}
              showSources={expandedSources.has(msg.id || i)}
              onToggleSources={() => toggleSources(msg.id || i)}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 20px 16px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-end',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '10px 10px 10px 16px',
          transition: 'border-color 0.15s',
        }}>
          <textarea
            ref={inputRef}
            className="input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
            style={{
              background: 'transparent', border: 'none', boxShadow: 'none',
              resize: 'none', minHeight: 24, maxHeight: 160,
              padding: 0, fontSize: 14, flex: 1,
            }}
            rows={1}
            disabled={chatSending}
          />
          <button
            className="btn btn-primary"
            onClick={send}
            disabled={!input.trim() || chatSending}
            style={{ borderRadius: 8, padding: '7px 14px', flexShrink: 0 }}
          >
            {chatSending ? <span className="spinner spinner-sm" /> : <SendIcon />}
          </button>
        </div>
        {useRag && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--green)', fontSize: 9 }}>●</span>
            RAG enabled · top {topK} chunks · semantic retrieval
          </div>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ msg, showSources, onToggleSources }) {
  const isUser = msg.role === 'user'
  const isPending = msg._pending
  const conf = msg.confidence ? confidenceLabel(msg.confidence) : null

  return (
    <div className="fade-in" style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 12,
      alignItems: 'flex-start',
    }}>
      {/* Avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: isUser ? 'var(--accent-1)' : 'var(--bg-overlay)',
        border: isUser ? 'none' : '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: isUser ? '#fff' : 'var(--text-accent)',
        fontFamily: 'var(--font-mono)',
      }}>
        {isUser ? 'U' : '⬡'}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{
          background: isUser ? 'var(--accent-1)' : 'var(--bg-elevated)',
          border: isUser ? 'none' : '1px solid var(--border-subtle)',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          padding: '10px 14px',
          color: isUser ? '#fff' : 'var(--text-primary)',
        }}>
          {isPending ? (
            <span style={{ display: 'flex', gap: 4, alignItems: 'center', color: 'var(--text-muted)' }}>
              <span className="spinner spinner-sm" />
              <span style={{ fontSize: 12 }}>Thinking…</span>
            </span>
          ) : (
            <div className="prose" style={{ fontSize: 14 }}>
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Meta row */}
        {!isPending && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {timeAgo(msg.created_at)}
            </span>
            {msg.model && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>· {msg.model}</span>}
            {conf && <span className={`badge ${conf.cls}`}>{conf.label} confidence</span>}
            {msg.rag_used && <span className="badge badge-purple">RAG</span>}
            {msg.sources?.length > 0 && (
              <button
                onClick={onToggleSources}
                style={{ fontSize: 11, color: 'var(--text-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {showSources ? '▲' : '▼'} {msg.sources.length} source{msg.sources.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        {/* Sources */}
        {showSources && msg.sources?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {msg.sources.map((src, i) => (
              <SourceCard key={i} source={src} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SourceCard({ source, index }) {
  const pct = Math.round(source.similarity * 100)
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderLeft: `3px solid ${simColor(source.similarity)}`,
      borderRadius: 'var(--r-sm)',
      padding: '10px 12px',
      fontSize: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          #{index + 1} · {truncate(source.document_title, 40)} · chunk {source.chunk_index}
        </span>
        <span style={{ color: simColor(source.similarity), fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {pct}%
        </span>
      </div>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>{source.content}</p>
    </div>
  )
}

function RagToggle({ useRag, setUseRag, topK, setTopK }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
        <span>RAG</span>
        <div
          onClick={() => setUseRag(!useRag)}
          style={{
            width: 32, height: 18, borderRadius: 99, cursor: 'pointer',
            background: useRag ? 'var(--accent-1)' : 'var(--bg-overlay)',
            border: '1px solid var(--border-default)',
            position: 'relative', transition: 'background 0.2s',
          }}
        >
          <div style={{
            position: 'absolute', top: 2,
            left: useRag ? 14 : 2,
            width: 12, height: 12, borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
          }} />
        </div>
      </label>
      {useRag && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>k=</span>
          <select
            value={topK}
            onChange={e => setTopK(Number(e.target.value))}
            style={{
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              border: '1px solid var(--border-default)', borderRadius: 4,
              padding: '1px 4px', fontSize: 12, fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}

function NewChatButton({ onReloadConversations }) {
  const { setActiveConversationId, setMessages, setActiveView, addToast } = useAppStore()
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
  return (
    <button className="btn btn-primary" onClick={newChat} style={{ fontSize: 14, padding: '10px 24px' }}>
      + Start new chat
    </button>
  )
}

function SendIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2L2 7l5 3 3 5 4-13Z" strokeLinejoin="round"/>
  </svg>
}
