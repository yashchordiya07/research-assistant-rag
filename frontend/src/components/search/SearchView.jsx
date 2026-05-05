import React, { useState } from 'react'
import { useAppStore } from '../../stores/appStore.js'
import { searchApi } from '../../services/api.js'
import { simColor, truncate } from '../../utils/helpers.js'

export default function SearchView() {
  const {
    searchResults, setSearchResults,
    searchLoading, setSearchLoading,
    documents, addToast,
  } = useAppStore()

  const [query, setQuery] = useState('')
  const [topK, setTopK] = useState(5)
  const [selectedDocs, setSelectedDocs] = useState([])

  const embeddedDocs = documents.filter(d => d.is_embedded)

  const run = async (e) => {
    e?.preventDefault()
    if (!query.trim()) return
    setSearchLoading(true)
    try {
      const result = await searchApi.query(
        query.trim(), topK,
        selectedDocs.length ? selectedDocs : null,
      )
      setSearchResults(result)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSearchLoading(false)
    }
  }

  const toggleDoc = (id) => {
    setSelectedDocs(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '0 24px', height: 'var(--header-h)',
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Semantic Search</span>
        <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {embeddedDocs.length} embedded document{embeddedDocs.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Search form */}
        <form onSubmit={run} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search semantically across your embedded documents…"
              style={{ flex: 1, fontSize: 14 }}
              disabled={searchLoading}
            />
            <button className="btn btn-primary" type="submit" disabled={!query.trim() || searchLoading} style={{ flexShrink: 0 }}>
              {searchLoading ? <span className="spinner spinner-sm" /> : null}
              Search
            </button>
          </div>

          {/* Options row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              Top K:
              <select value={topK} onChange={e => setTopK(Number(e.target.value))} style={{
                background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                border: '1px solid var(--border-default)', borderRadius: 4,
                padding: '2px 6px', fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer',
              }}>
                {[3, 5, 8, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>

            {embeddedDocs.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>Filter docs:</span>
                {embeddedDocs.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDoc(d.id)}
                    style={{
                      padding: '2px 8px', borderRadius: 99, fontSize: 11, cursor: 'pointer',
                      background: selectedDocs.includes(d.id) ? 'rgba(124,58,237,0.2)' : 'transparent',
                      border: `1px solid ${selectedDocs.includes(d.id) ? 'var(--accent-1)' : 'var(--border-default)'}`,
                      color: selectedDocs.includes(d.id) ? 'var(--text-accent)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {truncate(d.title, 24)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* No embedded docs notice */}
        {embeddedDocs.length === 0 && (
          <div className="card" style={{ background: 'var(--amber-bg)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <p style={{ fontSize: 13, color: 'var(--amber)' }}>
              ⚠ No embedded documents yet. Go to Documents, add content, and click Embed to enable semantic search.
            </p>
          </div>
        )}

        {/* Results */}
        {searchLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 'var(--r-md)' }} />)}
          </div>
        ) : searchResults ? (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
              {searchResults.total} result{searchResults.total !== 1 ? 's' : ''} for "{searchResults.query}"
            </div>
            {searchResults.total === 0 ? (
              <div className="empty-state">
                <div className="icon">🔍</div>
                <h3>No results found</h3>
                <p>Try different search terms or embed more documents.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {searchResults.results.map((r, i) => (
                  <SearchResultCard key={i} result={r} rank={i + 1} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <div className="icon">🔍</div>
            <h3>Semantic search</h3>
            <p>Enter a query above to find the most relevant chunks across your embedded documents using vector similarity.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SearchResultCard({ result, rank }) {
  const pct = Math.round(result.similarity * 100)
  const barWidth = `${Math.max(pct, 6)}%`

  return (
    <div className="card fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 22, height: 22, borderRadius: 4,
            background: 'var(--bg-overlay)', border: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0,
          }}>
            {rank}
          </span>
          <span style={{ fontWeight: 500, fontSize: 13 }}>{result.document_title}</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            chunk {result.chunk_index}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 80, height: 4, background: 'var(--bg-overlay)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: barWidth, height: '100%', background: simColor(result.similarity), borderRadius: 2, transition: 'width 0.4s' }} />
          </div>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: simColor(result.similarity), minWidth: 36 }}>
            {pct}%
          </span>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{result.content}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <span className={`badge ${result.similarity >= 0.75 ? 'badge-green' : result.similarity >= 0.5 ? 'badge-amber' : 'badge-red'}`}>
          {result.similarity >= 0.75 ? 'High relevance' : result.similarity >= 0.5 ? 'Medium' : 'Low'}
        </span>
        <span className="badge badge-blue">doc {result.document_id}</span>
      </div>
    </div>
  )
}
