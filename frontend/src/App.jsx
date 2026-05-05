import React, { useEffect } from 'react'
import Sidebar from './components/layout/Sidebar.jsx'
import ChatView from './components/chat/ChatView.jsx'
import DocumentsView from './components/documents/DocumentsView.jsx'
import SearchView from './components/search/SearchView.jsx'
import SystemView from './components/search/SystemView.jsx'
import ToastContainer from './components/ui/Toast.jsx'
import { useAppStore } from './stores/appStore.js'
import { useConversations } from './hooks/useData.js'

export default function App() {
  const { activeView } = useAppStore()
  const { reload: reloadConversations } = useConversations()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Sidebar onReloadConversations={reloadConversations} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
        {activeView === 'chat'      && <ChatView onReloadConversations={reloadConversations} />}
        {activeView === 'documents' && <DocumentsView />}
        {activeView === 'search'    && <SearchView />}
        {activeView === 'system'    && <SystemView />}
      </main>

      <ToastContainer />
    </div>
  )
}
