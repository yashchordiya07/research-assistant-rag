import React from 'react'
import { useAppStore } from '../../stores/appStore.js'
import { useSystemStatus } from '../../hooks/useData.js'

export default function SystemView() {
  const { systemStatus, statusLoading } = useAppStore()
  const { reload } = useSystemStatus()

  const s = systemStatus

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '0 24px', height: 'var(--header-h)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>System Status</span>
        <button className="btn btn-ghost btn-sm" onClick={reload} disabled={statusLoading}>
          {statusLoading ? <span className="spinner spinner-sm" /> : '↻'} Refresh
        </button>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {statusLoading && !s ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : !s ? (
          <div className="empty-state">
            <div className="icon">⚠️</div>
            <h3>Cannot reach backend</h3>
            <p>Make sure the FastAPI server is running on port 8000. Run: <code>uvicorn backend.main:app --reload</code></p>
          </div>
        ) : (
          <>
            {/* Service health grid */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                Services
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <StatusCard label="API" status={s.api} icon="🌐" />
                <StatusCard label="Database" status={s.database} icon="🗄️" />
                <StatusCard label="Ollama" status={s.ollama} icon="🤖" />
                <StatusCard label="Embeddings" status={s.ollama === 'ok' ? 'ok' : 'unavailable'} icon="⚡" />
              </div>
            </div>

            {/* Model info */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                Models
              </div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <InfoRow label="Chat model" value={s.ollama_model} />
                <div className="divider" style={{ margin: '0' }} />
                <InfoRow label="Embedding model" value={s.embedding_model} />
                {s.models_available?.length > 0 && (
                  <>
                    <div className="divider" style={{ margin: '0' }} />
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Available models</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {s.models_available.map(m => (
                          <span key={m} className="badge badge-purple" style={{ fontFamily: 'var(--font-mono)' }}>{m}</span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                Corpus stats
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                <StatTile label="Documents" value={s.document_count} />
                <StatTile label="Embedded" value={s.embedded_count} highlight />
                <StatTile label="Conversations" value={s.conversation_count} />
              </div>
            </div>

            {/* Instructions */}
            {s.ollama === 'unavailable' && (
              <div className="card" style={{ background: 'var(--amber-bg)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <h4 style={{ color: 'var(--amber)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ollama not detected</h4>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Install and start Ollama, then pull the required models:
                </p>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {['curl -fsSL https://ollama.ai/install.sh | sh', 'ollama serve', `ollama pull ${s.ollama_model}`, `ollama pull ${s.embedding_model}`].map(cmd => (
                    <code key={cmd} style={{
                      display: 'block', background: 'var(--bg-elevated)',
                      padding: '5px 10px', borderRadius: 4, fontSize: 12,
                      fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
                    }}>{cmd}</code>
                  ))}
                </div>
              </div>
            )}

            {/* Embedding coverage */}
            {s.document_count > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                  Embedding coverage
                </div>
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Documents embedded</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>
                      {s.embedded_count} / {s.document_count}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-overlay)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: 'var(--green)',
                      width: `${s.document_count ? Math.round(s.embedded_count / s.document_count * 100) : 0}%`,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {s.document_count ? Math.round(s.embedded_count / s.document_count * 100) : 0}% embedded
                    {s.embedded_count < s.document_count && (
                      <span style={{ color: 'var(--amber)', marginLeft: 8 }}>
                        · {s.document_count - s.embedded_count} pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatusCard({ label, status, icon }) {
  const ok = status === 'ok'
  const color = ok ? 'var(--green)' : 'var(--red)'
  const bg = ok ? 'var(--green-bg)' : 'var(--red-bg)'

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color, boxShadow: `0 0 6px ${color}`,
        }} className={ok ? 'pulse' : ''} />
      </div>
      <div>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, marginTop: 2 }}>{status}</div>
      </div>
    </div>
  )
}

function StatTile({ label, value, highlight }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 700, color: highlight ? 'var(--green)' : 'var(--text-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-accent)', fontSize: 12 }}>{value}</span>
    </div>
  )
}
