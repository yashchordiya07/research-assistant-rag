import { useEffect, useCallback } from 'react'
import { conversationsApi, documentsApi, systemApi } from '../services/api.js'
import { useAppStore } from '../stores/appStore.js'

// Load conversations list
export function useConversations() {
  const { setConversations, addToast } = useAppStore()

  const load = useCallback(async () => {
    try {
      const data = await conversationsApi.list()
      setConversations(data)
    } catch (e) {
      addToast(e.message, 'error')
    }
  }, [setConversations, addToast])

  useEffect(() => { load() }, [load])
  return { reload: load }
}

// Load messages for a conversation
export function useMessages(conversationId) {
  const { setMessages, setMessagesLoading, addToast } = useAppStore()

  const load = useCallback(async () => {
    if (!conversationId) return
    setMessagesLoading(true)
    try {
      const data = await conversationsApi.getMessages(conversationId)
      setMessages(data)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setMessagesLoading(false)
    }
  }, [conversationId, setMessages, setMessagesLoading, addToast])

  useEffect(() => { load() }, [load])
  return { reload: load }
}

// Load documents
export function useDocuments() {
  const { setDocuments, setDocumentsLoading, addToast } = useAppStore()

  const load = useCallback(async () => {
    setDocumentsLoading(true)
    try {
      const data = await documentsApi.list()
      setDocuments(data)
    } catch (e) {
      addToast(e.message, 'error')
    } finally {
      setDocumentsLoading(false)
    }
  }, [setDocuments, setDocumentsLoading, addToast])

  useEffect(() => { load() }, [load])
  return { reload: load }
}

// Load system status
export function useSystemStatus() {
  const { setSystemStatus, setStatusLoading } = useAppStore()

  const load = useCallback(async () => {
    setStatusLoading(true)
    try {
      const data = await systemApi.status()
      setSystemStatus(data)
    } catch (_e) {
      setSystemStatus(null)
    } finally {
      setStatusLoading(false)
    }
  }, [setSystemStatus, setStatusLoading])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  return { reload: load }
}
