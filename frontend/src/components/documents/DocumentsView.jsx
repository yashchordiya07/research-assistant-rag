import React, { useState, useRef } from 'react'
import { useAppStore } from '../../stores/appStore.js'
import { documentsApi } from '../../services/api.js'
import { useDocuments } from '../../hooks/useData.js'
import { formatBytes, timeAgo, truncate } from '../../utils/helpers.js'

export default function DocumentsView() {
  const {
    documents, documentsLoading,
    updateDocument, removeDocument, addDocument,
    addToast,
  } = useAppStore()

  const { reload } = useDocuments()
  const [tab, setTab] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [embeddingId, setEmbeddingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const fileRef = useRef(null)

  const filtered = tab === 'all' ? documents :
                   tab === 'embedded' ? documents.filter(d => d.is_embedded) :
                   documents.filter(d => !d.is_embedded)

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    for (const f of files) await uploadFile(f)
  }

  const uploadFile = async (file) => {
    try {
      const doc = await documentsApi.upload(file, file.name)
      addDocument(doc)
      addToast(`"${doc.title}" uploaded`, 'success')
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const handleEmbed = async (id) => {
    setEmbeddingId(id)
    try {
      const result = await documentsApi.embed(id)
      updateDocument(id, { is_embedded: true, chunk_count: result.chunks_created })
      addToast(`Embedded ${result.chunks_created} chunks`, 'success')
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setEmbeddingId(null)
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await documentsApi.delete(id)
      removeDocument(id)
      addToast('Document deleted', 'success')
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const embeddedCount = documents.filter(d => d.is_embedded).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '0 24px', height: 'var(--header-h)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Documents</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {documents.length} total · {embeddedCount} embedded
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            ↑ Upload file
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            + Add text
          </button>
          <input ref={fileRef} type="file" style={{ display: 'none' }} accept=".txt,.pdf,.md" multiple
            onChange={e => { Array.from(e.target.files).forEach(uploadFile); e.target.value = '' }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '10px 24px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 0, flexShrink: 0 }}>
        {[['all', 'All', documents.length], ['embedded', 'Embedded', embeddedCount], ['pending', 'Pending', documents.length - embeddedCount]].map(([id, label, count]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: '8px 16px', background: 'none', border: 'none',
              borderBottom: tab === id ? '2px solid var(--accent-1)' : '2px solid transparent',
              color: tab === id ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)',
              marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {label}
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Drop zone + list */}
      <div
        className="scroll-y"
        style={{ flex: 1, padding: 24 }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {dragging && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(124,58,237,0.08)', border: '2px dashed var(--accent-1)',
            borderRadius: 'var(--r-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-accent)' }}>Drop files here</span>
          </div>
        )}

        {documentsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--r-md)' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📄</div>
            <h3>{tab === 'embedded' ? 'No embedded documents' : tab === 'pending' ? 'All documents embedded' : 'No documents yet'}</h3>
            <p>Upload text files, PDFs, or paste document content. Then generate embeddings to enable semantic search.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onEmbed={() => handleEmbed(doc.id)}
                onDelete={() => handleDelete(doc.id)}
                embedding={embeddingId === doc.id}
                deleting={deletingId === doc.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add text modal */}
      {showAdd && <AddTextModal onClose={() => setShowAdd(false)} onAdd={d => { addDocument(d); setShowAdd(false) }} />}
    </div>
  )
}

function DocumentCard({ doc, onEmbed, onDelete, embedding, deleting }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon */}
        <div style={{
          width: 38, height: 38, borderRadius: 8, flexShrink: 0,
          background: doc.is_embedded ? 'var(--green-bg)' : 'var(--bg-overlay)',
          border: `1px solid ${doc.is_embedded ? 'rgba(52,211,153,0.2)' : 'var(--border-default)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17,
        }}>
          {doc.file_type?.includes('pdf') ? '📕' : doc.file_type?.includes('md') ? '📝' : '📄'}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>{doc.title}</span>
            <span className={`badge ${doc.is_embedded ? 'badge-green' : 'badge-amber'}`}>
              {doc.is_embedded ? `embedded · ${doc.chunk_count} chunks` : 'not embedded'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 3, display: 'flex', gap: 10 }}>
            {doc.file_type && <span>{doc.file_type}</span>}
            {doc.file_size && <span>{formatBytes(doc.file_size)}</span>}
            <span>{timeAgo(doc.created_at)}</span>
          </div>
          {doc.content_preview && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5, lineHeight: 1.5 }}>
              {expanded ? doc.content_preview : truncate(doc.content_preview, 120)}
              {doc.content_preview.length > 120 && (
                <button onClick={() => setExpanded(!expanded)} style={{ color: 'var(--text-accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, marginLeft: 4 }}>
                  {expanded ? 'less' : 'more'}
                </button>
              )}
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onEmbed}
            disabled={embedding}
            style={{ minWidth: 90 }}
          >
            {embedding ? <span className="spinner spinner-sm" /> : '⚡'}
            {embedding ? 'Embedding…' : doc.is_embedded ? 'Re-embed' : 'Embed'}
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? <span className="spinner spinner-sm" /> : '✕'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddTextModal({ onClose, onAdd }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const { addToast } = useAppStore()

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) { addToast('Title and content required', 'error'); return }
    setLoading(true)
    try {
      const doc = await documentsApi.create(title.trim(), content.trim())
      onAdd(doc)
      addToast('Document added', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card fade-in" style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>Add document text</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Title</label>
            <input className="input" placeholder="Document title" value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Content</label>
            <textarea className="input" placeholder="Paste document content here…" value={content} onChange={e => setContent(e.target.value)}
              required style={{ flex: 1, minHeight: 220, resize: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner spinner-sm" /> : null}
              Add document
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
