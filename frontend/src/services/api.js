import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'Request failed'
    return Promise.reject(new Error(msg))
  }
)

// ── Conversations ──────────────────────────────────────────────────────────
export const conversationsApi = {
  list: ()                       => api.get('/conversations').then(r => r.data),
  create: (title = 'New Chat')   => api.post('/conversations', { title }).then(r => r.data),
  rename: (id, title)            => api.patch(`/conversations/${id}`, { title }).then(r => r.data),
  delete: (id)                   => api.delete(`/conversations/${id}`).then(r => r.data),
  getMessages: (id)              => api.get(`/conversations/${id}/messages`).then(r => r.data),
}

// ── Chat ──────────────────────────────────────────────────────────────────
export const chatApi = {
  send: (conversationId, message, useRag = true, topK = 5) =>
    api.post('/chat', { conversation_id: conversationId, message, use_rag: useRag, top_k: topK })
       .then(r => r.data),
}

// ── Documents ─────────────────────────────────────────────────────────────
export const documentsApi = {
  list:   ()          => api.get('/documents').then(r => r.data),
  create: (title, content) =>
    api.post('/documents', { title, content }).then(r => r.data),
  upload: (file, title) => {
    const fd = new FormData()
    fd.append('file', file)
    if (title) fd.append('title', title)
    return api.post('/documents/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  delete: (id) => api.delete(`/documents/${id}`).then(r => r.data),
  embed:  (id) => api.post(`/documents/${id}/embed`).then(r => r.data),
}

// ── Search ────────────────────────────────────────────────────────────────
export const searchApi = {
  query: (query, topK = 5, documentIds = null) =>
    api.post('/search', { query, top_k: topK, document_ids: documentIds }).then(r => r.data),
}

// ── System ────────────────────────────────────────────────────────────────
export const systemApi = {
  status: () => api.get('/system/status').then(r => r.data),
}

export default api
