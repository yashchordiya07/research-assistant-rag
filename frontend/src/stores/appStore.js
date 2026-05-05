import { create } from 'zustand'

export const useAppStore = create((set, get) => ({
  // ── Active view ──────────────────────────────────────────────────────
  activeView: 'chat',         // 'chat' | 'documents' | 'search' | 'system'
  setActiveView: (v) => set({ activeView: v }),

  // ── Conversations ────────────────────────────────────────────────────
  conversations: [],
  activeConversationId: null,
  messages: [],
  messagesLoading: false,
  chatSending: false,

  setConversations: (c) => set({ conversations: c }),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  setMessages: (m) => set({ messages: m }),
  setMessagesLoading: (v) => set({ messagesLoading: v }),
  setChatSending: (v) => set({ chatSending: v }),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateLastAssistantMessage: (content, meta = {}) =>
    set((s) => {
      const msgs = [...s.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], content, ...meta }
          break
        }
      }
      return { messages: msgs }
    }),

  // ── Documents ────────────────────────────────────────────────────────
  documents: [],
  documentsLoading: false,
  setDocuments: (d) => set({ documents: d }),
  setDocumentsLoading: (v) => set({ documentsLoading: v }),
  updateDocument: (id, patch) =>
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })),
  removeDocument: (id) =>
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),
  addDocument: (doc) => set((s) => ({ documents: [doc, ...s.documents] })),

  // ── Search ───────────────────────────────────────────────────────────
  searchResults: null,
  searchLoading: false,
  setSearchResults: (r) => set({ searchResults: r }),
  setSearchLoading: (v) => set({ searchLoading: v }),

  // ── System status ────────────────────────────────────────────────────
  systemStatus: null,
  statusLoading: false,
  setSystemStatus: (s) => set({ systemStatus: s }),
  setStatusLoading: (v) => set({ statusLoading: v }),

  // ── Toast notifications ──────────────────────────────────────────────
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Date.now()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  // ── RAG settings ─────────────────────────────────────────────────────
  useRag: true,
  topK: 5,
  setUseRag: (v) => set({ useRag: v }),
  setTopK: (v) => set({ topK: v }),
}))
