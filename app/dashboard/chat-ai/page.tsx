'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
    syncDarazChatSessions,
    sendChatMessage,
    getChatSettings,
    updateChatSettings,
    updateMessageTags,
    getChatRules,
    addChatRule,
    deleteChatRule,
    type ChatSettings
} from '@/features/chat/actions/chat-actions'
import {
    MessageSquare,
    Cpu,
    Send,
    Tag,
    Trash2,
    X,
    RefreshCw,
    Store,
    ShoppingBag,
    Clock,
    Search,
    Shield,
    User,
    Copy,
    Star
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui-shim'
interface Store {
    id: string
    company_name: string
    seller_account: string
}

interface ChatSession {
    session_id: string
    store_id: string
    buyer_id: string
    title: string
    head_url?: string | null
    unread_count: number
    last_message_id?: string | null
    last_message_time?: string | null
    last_message_summary?: string | null
    updated_at: string
}

interface ChatMessage {
    message_id: string
    session_id: string
    from_account_id: string
    from_account_type: string
    to_account_id: string
    to_account_type: string
    content: string
    template_id: string
    send_time: string
    auto_reply: boolean
    tags: string[]
}

interface ChatRule {
    id: string
    store_id: string
    match_type: 'exact' | 'keyword'
    pattern: string
    reply_content: string
}

export default function ChatAiDashboard() {
    const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat')
    const [showAccountModal, setShowAccountModal] = useState(false)
    const [connectedChatStores, setConnectedChatStores] = useState<string[]>([])
    const [connectingStoreId, setConnectingStoreId] = useState<string | null>(null)
    const [stores, setStores] = useState<Store[]>([])
    const [activeStoreId, setActiveStoreId] = useState<string>('')
    const [storeSettings, setStoreSettings] = useState<Record<string, ChatSettings>>({})
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    
    // UI filters
    const [searchQuery, setSearchQuery] = useState('')
    const [replyText, setReplyText] = useState('')
    
    // Settings state
    const [rules, setRules] = useState<ChatRule[]>([])
    const [newRuleType, setNewRuleType] = useState<'exact' | 'keyword'>('keyword')
    const [newRulePattern, setNewRulePattern] = useState('')
    const [newRuleReply, setNewRuleReply] = useState('')
    const [savingSettings, setSavingSettings] = useState(false)

    // Loaders
    const [loadingSessions, setLoadingSessions] = useState(false)
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [syncing, setSyncing] = useState(false)

    // Right sidebar (Customer details / context) state
    const [customerOrders, setCustomerOrders] = useState<any[]>([])
    const [loadingOrders, setLoadingOrders] = useState(false)
    const [ordersSearchQuery, setOrdersSearchQuery] = useState('')
    const [activeRightTab, setActiveRightTab] = useState<'order' | 'product' | 'voucher'>('order')

    const chatEndRef = useRef<HTMLDivElement>(null)

    // Preset tags for customer queries
    const PRESET_TAGS = ['Change Address', 'Change Phone Number', 'Wholesale Inquiry', 'Urgent Return', 'General FAQ']

    // 1. Fetch initial store list & active connections
    useEffect(() => {
        async function fetchStores() {
            const { data, error } = await supabase
                .from('online_stores')
                .select('*')
                .order('company_name')

            if (error) {
                toast.error('Failed to load stores')
                console.error(error)
            } else {
                setStores(data || [])
                if (data && data.length > 0) {
                    setActiveStoreId(data[0].id)
                }
            }
        }
        fetchStores()
        fetchConnectedChatStores()
    }, [])

    async function fetchConnectedChatStores() {
        const { data, error } = await supabase
            .from('daraz_api_tokens')
            .select('store_id')
            .eq('app_type', 'chat')
        if (!error && data) {
            setConnectedChatStores(data.map(d => d.store_id))
        }
    }

    const handleConnectChat = async (storeId: string) => {
        setConnectingStoreId(storeId)
        try {
            const response = await fetch(`/api/daraz/auth/url?storeId=${storeId}&appType=chat`)
            const data = await response.json()
            if (data.url) {
                window.location.href = data.url
            } else {
                throw new Error(data.error || 'Failed to generate auth URL')
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to initiate connection')
            setConnectingStoreId(null)
        }
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('status') === 'success') {
            toast.success('Daraz Chat connected successfully!', {
                description: 'Your assistant can now receive and send messages.'
            })
            // Clean query parameters from URL
            const newUrl = window.location.pathname
            window.history.replaceState({}, '', newUrl)
            fetchConnectedChatStores()
        }
    }, [])

    // 2. Fetch Settings and Rules when active store changes
    useEffect(() => {
        if (!activeStoreId) return

        async function loadStoreConfig() {
            try {
                // Fetch Settings
                const settings = await getChatSettings(activeStoreId)
                setStoreSettings(prev => ({ ...prev, [activeStoreId]: settings }))

                // Fetch Rules
                const ruleList = await getChatRules(activeStoreId)
                setRules(ruleList)
            } catch (err) {
                console.error('Failed to load store chat configurations:', err)
            }
        }
        loadStoreConfig()
    }, [activeStoreId])

    // 3. Fetch Sessions when active store or settings change
    useEffect(() => {
        if (!activeStoreId) return
        
        async function fetchSessions() {
            setLoadingSessions(true)
            const { data, error } = await supabase
                .from('daraz_chat_sessions')
                .select('*')
                .eq('store_id', activeStoreId)
                .order('last_message_time', { ascending: false })

            if (error) {
                console.error(error)
            } else {
                setSessions(data || [])
                if (data && data.length > 0 && !activeSessionId) {
                    setActiveSessionId(data[0].session_id)
                }
            }
            setLoadingSessions(false)
        }
        fetchSessions()
    }, [activeStoreId, activeSessionId])

    // 4. Fetch messages for active session & subscribe to real-time additions
    useEffect(() => {
        if (!activeSessionId) {
            setMessages([])
            return
        }

        async function fetchMessages() {
            setLoadingMessages(true)
            const { data, error } = await supabase
                .from('daraz_chat_messages')
                .select('*')
                .eq('session_id', activeSessionId)
                .order('send_time', { ascending: true })

            if (error) {
                console.error(error)
            } else {
                setMessages(data || [])
                setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
            }
            setLoadingMessages(false)
        }
        fetchMessages()

        // Realtime Subscription
        const channel = supabase
            .channel(`realtime:messages:${activeSessionId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'daraz_chat_messages',
                filter: `session_id=eq.${activeSessionId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setMessages(prev => {
                        if (prev.some(m => m.message_id === payload.new.message_id)) return prev
                        return [...prev, payload.new as ChatMessage]
                    })
                    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
                } else if (payload.eventType === 'UPDATE') {
                    setMessages(prev => prev.map(m => m.message_id === payload.new.message_id ? payload.new as ChatMessage : m))
                } else if (payload.eventType === 'DELETE') {
                    setMessages(prev => prev.filter(m => m.message_id !== payload.old.message_id))
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [activeSessionId])

    // Helper: Determine if store chat is connected
    const isStoreConnected = (storeId: string) => {
        return storeSettings[storeId]?.messaging_enabled !== false
    }

    // Filter sessions based on search, tags, and connection status
    const filteredSessions = sessions.filter(session => {
        // Hide sessions if store is disconnected
        if (!isStoreConnected(session.store_id)) return false

        const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (session.last_message_summary && session.last_message_summary.toLowerCase().includes(searchQuery.toLowerCase()))
        
        return matchesSearch
    })

    // Sync chats manual trigger
    const handleSync = async () => {
        if (!activeStoreId) return
        setSyncing(true)
        toast.info('Syncing chat sessions from Daraz...')
        try {
            const result = await syncDarazChatSessions(activeStoreId)
            if (result.success) {
                toast.success(`Successfully synced ${result.count} chats!`)
                
                // Refresh sessions from local DB
                const { data } = await supabase
                    .from('daraz_chat_sessions')
                    .select('*')
                    .eq('store_id', activeStoreId)
                    .order('last_message_time', { ascending: false })
                if (data) setSessions(data)
            } else {
                toast.error(result.reason || 'Failed to sync chats. Check API settings.')
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Sync failed'
            toast.error(errorMsg)
        } finally {
            setSyncing(false)
        }
    }

    // Send chat message
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!replyText.trim() || !activeSessionId || !activeStoreId) return

        const textToSend = replyText
        setReplyText('')

        try {
            await sendChatMessage(activeStoreId, activeSessionId, '1', textToSend)
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to send message'
            toast.error(errorMsg)
            setReplyText(textToSend) // Restore text on failure
        }
    }

    // Toggle Tag on Message
    const handleToggleTag = async (messageId: string, tag: string) => {
        const message = messages.find(m => m.message_id === messageId)
        if (!message) return

        let updatedTags = [...(message.tags || [])]
        if (updatedTags.includes(tag)) {
            updatedTags = updatedTags.filter(t => t !== tag)
        } else {
            updatedTags.push(tag)
        }

        try {
            await updateMessageTags(messageId, updatedTags)
            toast.success(`Message tag updated`)
        } catch {
            toast.error('Failed to update tags')
        }
    }

    // Save Settings
    const handleSaveSettings = async (payload: Partial<ChatSettings>) => {
        if (!activeStoreId) return
        setSavingSettings(true)
        try {
            const res = await updateChatSettings(activeStoreId, payload)
            if (res.success) {
                setStoreSettings(prev => ({
                    ...prev,
                    [activeStoreId]: { ...prev[activeStoreId], ...payload }
                }))
                toast.success('AI Settings updated successfully!')
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to update settings'
            toast.error(errorMsg)
        } finally {
            setSavingSettings(false)
        }
    }

    // Add Matching Rule
    const handleAddRule = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newRulePattern.trim() || !newRuleReply.trim() || !activeStoreId) return

        try {
            await addChatRule(activeStoreId, {
                match_type: newRuleType,
                pattern: newRulePattern,
                reply_content: newRuleReply
            })
            toast.success('Automation rule added')
            setNewRulePattern('')
            setNewRuleReply('')
            
            // Refresh rules list
            const ruleList = await getChatRules(activeStoreId)
            setRules(ruleList)
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to add rule'
            toast.error(errorMsg)
        }
    }

    // Delete Rule
    const handleDeleteRule = async (id: string) => {
        try {
            await deleteChatRule(id)
            toast.success('Rule deleted')
            setRules(prev => prev.filter(r => r.id !== id))
        } catch {
            toast.error('Failed to delete rule')
        }
    }

    // Fetch orders for the customer in the active session
    useEffect(() => {
        if (!activeSession || !activeStoreId) {
            setCustomerOrders([])
            return
        }

        async function fetchCustomerOrders() {
            setLoadingOrders(true)
            try {
                // Fetch all orders for this store and join items with product image URLs
                const { data, error } = await supabase
                    .from('daraz_orders')
                    .select(`
                        id,
                        order_id,
                        order_number,
                        order_status,
                        price,
                        order_date,
                        daraz_created_at,
                        customer_name,
                        shipping_name,
                        tracking_number,
                        daraz_order_items (
                            id,
                            product_name,
                            quantity,
                            amount,
                            seller_sku,
                            item_status,
                            product_id,
                            products (
                                image_url
                            )
                        )
                    `)
                    .eq('store_id', activeStoreId)
                    .order('order_date', { ascending: false })

                if (error) {
                    console.error('Error fetching customer orders:', error)
                } else {
                    setCustomerOrders(data || [])
                }
            } catch (err) {
                console.error('Failed to load customer orders:', err)
            } finally {
                setLoadingOrders(false)
            }
        }

        fetchCustomerOrders()
    }, [activeSessionId, activeStoreId])

    // Filter customer orders based on active session's title (username) or manual search query
    const filteredOrders = customerOrders.filter(order => {
        if (!activeSession) return false

        const title = activeSession.title?.toLowerCase() || ''
        const custName = order.customer_name?.toLowerCase() || ''
        const shipName = order.shipping_name?.toLowerCase() || ''
        const orderNum = order.order_number?.toLowerCase() || ''
        const orderId = order.order_id?.toLowerCase() || ''

        // Exact or partial matches for the customer's name
        const matchesAuto = title && (custName.includes(title) || shipName.includes(title) || title.includes(custName))

        if (ordersSearchQuery.trim() !== '') {
            const query = ordersSearchQuery.toLowerCase().trim()
            return custName.includes(query) || 
                shipName.includes(query) || 
                orderNum.includes(query) || 
                orderId.includes(query) ||
                order.daraz_order_items?.some((item: any) => 
                    item.product_name?.toLowerCase().includes(query) || 
                    item.seller_sku?.toLowerCase().includes(query)
                )
        }

        return matchesAuto
    })

    // Handler to send order card to the conversation
    const handleSendOrderCard = async (orderId: string) => {
        if (!activeStoreId || !activeSessionId) return
        toast.info('Sending order card...')
        try {
            await sendChatMessage(activeStoreId, activeSessionId, '10007', undefined, undefined, orderId)
            toast.success('Order card sent successfully!')
            
            // Refresh messages locally
            const { data } = await supabase
                .from('daraz_chat_messages')
                .select('*')
                .eq('session_id', activeSessionId)
                .order('send_time', { ascending: true })
            if (data) setMessages(data)
        } catch (err: any) {
            toast.error(err.message || 'Failed to send order card')
        }
    }

    // Handler to send guide link text summary to the conversation
    const handleSendGuideLink = async (orderNumber: string, status: string, trackingNumber?: string) => {
        if (!activeStoreId || !activeSessionId) return
        toast.info('Sending order guide link...')
        try {
            const txt = `Order Status Details:\nOrder Number: ${orderNumber}\nStatus: ${status}\nTracking Number: ${trackingNumber || 'Pending / In Processing'}`
            await sendChatMessage(activeStoreId, activeSessionId, '1', txt)
            toast.success('Order status details sent!')
            
            // Refresh messages locally
            const { data } = await supabase
                .from('daraz_chat_messages')
                .select('*')
                .eq('session_id', activeSessionId)
                .order('send_time', { ascending: true })
            if (data) setMessages(data)
        } catch (err: any) {
            toast.error(err.message || 'Failed to send guide link')
        }
    }

    const handleCopyText = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success('Copied to clipboard!')
    }

    // Helper: Parse content string to JSON or keep text
    const parseMsgContent = (content: string) => {
        try {
            const parsed = JSON.parse(content)
            return parsed
        } catch {
            return { txt: content }
        }
    }

    const currentStoreSettings = storeSettings[activeStoreId] || {}
    const activeSession = sessions.find(s => s.session_id === activeSessionId)

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] bg-zinc-50 dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
            {/* Header Area */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
                        Chat & AI Assistant
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Manage customer messaging, configure smart keywords, and deploy Gemini AI auto-replies.
                    </p>
                </div>
                
                {/* Store selection and Sync buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1.5 border border-zinc-200 dark:border-zinc-700">
                        <Store size={16} className="text-zinc-500 ml-2" />
                        <select
                            value={activeStoreId}
                            onChange={(e) => {
                                setActiveStoreId(e.target.value)
                                setActiveSessionId(null)
                            }}
                            className="bg-transparent border-0 text-sm font-medium focus:ring-0 text-zinc-700 dark:text-zinc-200 cursor-pointer pr-8"
                        >
                            {stores.map((s) => (
                                <option key={s.id} value={s.id} className="dark:bg-zinc-900">
                                    {s.company_name} ({s.seller_account})
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => setShowAccountModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-700 bg-white dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-all active:scale-95"
                    >
                        <Store size={16} className="text-zinc-500" />
                        Daraz Account
                    </button>

                    <button
                        onClick={handleSync}
                        disabled={syncing || !isStoreConnected(activeStoreId)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-all
                            ${syncing || !isStoreConnected(activeStoreId)
                                ? 'bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed opacity-50' 
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95'
                            }`}
                    >
                        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync Daraz'}
                    </button>

                    <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200 dark:border-zinc-700">
                        <button
                            onClick={() => setActiveTab('chat')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                activeTab === 'chat'
                                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-white shadow-sm'
                                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                            }`}
                        >
                            <MessageSquare size={14} />
                            Chat
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                activeTab === 'settings'
                                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-white shadow-sm'
                                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                            }`}
                        >
                            <Cpu size={14} />
                            AI & Automation
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Workspace */}
            {activeTab === 'chat' ? (
                /* ----------------- CHAT WORKSPACE ----------------- */
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar: Session Lists */}
                    <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0">
                        {/* Search and Filters */}
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                                <input
                                    type="text"
                                    placeholder="Search buyer name or message..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 w-full text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-700 dark:text-zinc-200"
                                />
                            </div>
                        </div>

                        {/* Session list */}
                        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {loadingSessions ? (
                                <div className="p-8 text-center text-zinc-500">
                                    <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2 text-zinc-400" />
                                    <span className="text-xs">Loading sessions...</span>
                                </div>
                            ) : !isStoreConnected(activeStoreId) ? (
                                <div className="p-8 text-center text-zinc-500">
                                    <Shield size={24} className="mx-auto mb-2 text-zinc-400" />
                                    <p className="text-xs font-semibold">Store Account Disconnected</p>
                                    <p className="text-[10px] text-zinc-400 mt-1">Connect this store in the &quot;AI &amp; Automation&quot; tab to show messages.</p>
                                </div>
                            ) : filteredSessions.length === 0 ? (
                                <div className="p-8 text-center text-zinc-500 text-xs">
                                    No active conversations found.
                                </div>
                            ) : (
                                filteredSessions.map((session) => {
                                    const isActive = session.session_id === activeSessionId
                                    const formattedTime = session.last_message_time
                                        ? new Date(session.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        : ''
                                    return (
                                        <button
                                            key={session.session_id}
                                            onClick={() => setActiveSessionId(session.session_id)}
                                            className={`w-full p-4 flex gap-3 text-left transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                                                isActive ? 'bg-blue-50/70 dark:bg-blue-950/20 border-l-4 border-blue-600' : ''
                                            }`}
                                        >
                                            {/* Avatar placeholder */}
                                            <div className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm shadow-inner">
                                                {session.title.substring(0, 2).toUpperCase()}
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-0.5">
                                                    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                                                        {session.title}
                                                    </h3>
                                                    <span className="text-[10px] text-zinc-400">{formattedTime}</span>
                                                </div>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                                    {session.last_message_summary || 'No message history'}
                                                </p>
                                            </div>

                                            {/* Unread count */}
                                            {session.unread_count > 0 && (
                                                <div className="self-center shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                                                    {session.unread_count}
                                                </div>
                                            )}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Middle: Active Chat Window */}
                    <div className="flex-1 bg-zinc-50 dark:bg-zinc-950 flex flex-col min-w-0 h-full border-r border-zinc-200 dark:border-zinc-800">
                        {activeSession ? (
                            <>
                                {/* Chat Header */}
                                <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex justify-between items-center shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold text-sm">
                                            {activeSession.title.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                                                {activeSession.title}
                                            </h2>
                                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                                <span>Active Daraz Session</span>
                                                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                                                <span>Buyer ID: {activeSession.buyer_id}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Messages Viewport */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {loadingMessages ? (
                                        <div className="flex items-center justify-center h-full">
                                            <RefreshCw className="animate-spin text-zinc-400 mr-2" />
                                            <span className="text-sm text-zinc-500">Loading chat history...</span>
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex items-center justify-center h-full text-zinc-400 text-xs">
                                            No messages yet. Send a message to start the conversation!
                                        </div>
                                    ) : (
                                        messages.map((message) => {
                                            const isSelf = String(message.from_account_type) === '1'
                                            const parsed = parseMsgContent(message.content)
                                            const formattedTime = new Date(message.send_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

                                            // Render product/order card details if templates match
                                            const isProductCard = String(message.template_id) === '10006'
                                            const isOrderCard = String(message.template_id) === '10007'

                                            return (
                                                <div
                                                    key={message.message_id}
                                                    className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                                                >
                                                    {/* Message bubble */}
                                                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm relative group ${
                                                        isSelf 
                                                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-none' 
                                                            : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-tl-none'
                                                    }`}>
                                                        {/* Render based on card type */}
                                                        {isProductCard ? (
                                                            <div className="flex flex-col gap-2 p-1 min-w-[200px]">
                                                                <div className="flex items-center gap-2 text-xs font-bold text-orange-500 uppercase">
                                                                    <ShoppingBag size={12} /> Product Inquiry
                                                                </div>
                                                                <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                                    Item ID: {parsed.itemId || parsed.item_id || 'N/A'}
                                                                </div>
                                                                <p className="text-xs text-zinc-400 mt-1">This message contains a product card attachment from Daraz.</p>
                                                            </div>
                                                        ) : isOrderCard ? (
                                                            <div className="flex flex-col gap-2 p-1 min-w-[200px]">
                                                                <div className="flex items-center gap-2 text-xs font-bold text-blue-500 uppercase">
                                                                    <ShoppingBag size={12} /> Order Card
                                                                </div>
                                                                <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-350">
                                                                    Order ID: {parsed.orderId || parsed.order_id || 'N/A'}
                                                                </div>
                                                                <p className="text-xs text-zinc-400 mt-1">Order details shared in conversation.</p>
                                                            </div>
                                                        ) : (
                                                            // Regular text
                                                            <p className="whitespace-pre-wrap">{parsed.txt || parsed.content || message.content}</p>
                                                        )}

                                                        {/* Timestamp and AutoReply Tag */}
                                                        <div className={`flex items-center gap-1.5 mt-1.5 text-[9px] ${isSelf ? 'text-blue-200 justify-end' : 'text-zinc-400'}`}>
                                                            <span>{formattedTime}</span>
                                                            {message.auto_reply && (
                                                                <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 px-1 rounded font-semibold text-[8px] uppercase">
                                                                    AI Auto-Reply
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Preset Tag Actions Popover (Hover list for admin) */}
                                                        <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 bg-white dark:bg-zinc-900 shadow-md border border-zinc-200 dark:border-zinc-800 rounded-full px-2 py-1 z-10 ${
                                                            isSelf ? 'right-full mr-2' : 'left-full ml-2'
                                                        }`}>
                                                            <span className="text-[10px] font-bold text-zinc-400 mr-1 flex items-center gap-0.5"><Tag size={10} /> Tag:</span>
                                                            {PRESET_TAGS.map(tag => {
                                                                const isTagged = message.tags?.includes(tag)
                                                                return (
                                                                    <button
                                                                        key={tag}
                                                                        onClick={() => handleToggleTag(message.message_id, tag)}
                                                                        title={tag}
                                                                        className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                                                                            isTagged 
                                                                                ? 'bg-orange-500 border-orange-500 text-white' 
                                                                                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                                                                        }`}
                                                                    >
                                                                        {tag.charAt(0)}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Active tag pills displayed below message */}
                                                    {message.tags && message.tags.length > 0 && (
                                                        <div className={`flex flex-wrap gap-1 mt-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                                                            {message.tags.map((tag: string) => (
                                                                <span 
                                                                    key={tag} 
                                                                    className="bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-200/50 dark:border-orange-900/40 rounded-full px-2 py-0.5 text-[9px] font-semibold flex items-center gap-1"
                                                                >
                                                                    <Tag size={8} /> {tag}
                                                                    <button 
                                                                        onClick={() => handleToggleTag(message.message_id, tag)} 
                                                                        className="hover:text-red-500 text-orange-400 transition-colors"
                                                                    >
                                                                        <X size={8} />
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Quick Replies & Input Bar */}
                                <div className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-4 shrink-0">
                                    {/* Presets suggestions bar */}
                                    <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
                                        <span className="text-[10px] font-bold text-zinc-400 self-center shrink-0 uppercase tracking-wider">Quick:</span>
                                        {[
                                            'Hello, how can I help you today?',
                                            'Thank you for your inquiry. Checking stock right now.',
                                            'Your order has been shipped and is in transit.',
                                            'Please follow our store for discount vouchers!'
                                        ].map(template => (
                                            <button
                                                key={template}
                                                onClick={() => setReplyText(template)}
                                                className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 text-xs px-3 py-1.5 rounded-full shrink-0 border border-zinc-200/50 dark:border-zinc-700/50 transition-colors"
                                            >
                                                {template}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Message form */}
                                    <form onSubmit={handleSendMessage} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder="Write your response..."
                                            className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-100"
                                        />
                                        <button
                                            type="submit"
                                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white shadow px-5 rounded-xl flex items-center justify-center transition-all"
                                        >
                                            <Send size={16} />
                                        </button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-sm">
                                <MessageSquare size={32} className="text-zinc-400 mb-2" />
                                Select a conversation thread from the sidebar to begin.
                            </div>
                        )}
                    </div>

                    {/* Right Column: Customer Info & Orders Sidebar (Daraz-like) */}
                    {activeSession && (
                        <div className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0 h-full overflow-hidden">
                            {/* Profile details */}
                            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col items-center text-center space-y-2 shrink-0">
                                <div className="h-16 w-16 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold text-xl shadow-inner border border-blue-200/50 dark:border-blue-800/50">
                                    {activeSession.title.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="space-y-0.5">
                                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 justify-center">
                                        <User size={14} className="text-zinc-400" />
                                        {activeSession.title}
                                    </h3>
                                    <p className="text-[10px] text-zinc-400">Buyer ID: {activeSession.buyer_id}</p>
                                </div>
                                
                                {/* Assign & Note buttons */}
                                <div className="flex gap-1.5 w-full pt-1.5">
                                    <button className="flex-1 text-center py-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-md">
                                        Assign
                                    </button>
                                    <button className="flex items-center justify-center p-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-550 border border-zinc-200 dark:border-zinc-700 rounded-md">
                                        <Star size={12} className="text-zinc-400" />
                                    </button>
                                    <button className="flex items-center justify-center p-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-550 border border-zinc-200 dark:border-zinc-700 rounded-md text-[10px] font-bold px-1.5">
                                        ···
                                    </button>
                                </div>
                            </div>

                            {/* Tab Switcher */}
                            <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-center text-xs font-semibold shrink-0 bg-zinc-50/50 dark:bg-zinc-900/30">
                                {(['order', 'product', 'voucher'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveRightTab(tab)}
                                        className={`flex-1 py-2.5 border-b-2 capitalize transition-all ${
                                            activeRightTab === tab
                                                ? 'border-orange-500 text-orange-500 font-bold bg-white dark:bg-zinc-900'
                                                : 'border-transparent text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* Scrollable Content Tab Views */}
                            <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/20 p-3">
                                {activeRightTab === 'order' && (
                                    <div className="space-y-3">
                                        {/* Order Search bar */}
                                        <div className="relative shrink-0">
                                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-450" />
                                            <input
                                                type="text"
                                                placeholder="Search orders..."
                                                value={ordersSearchQuery}
                                                onChange={(e) => setOrdersSearchQuery(e.target.value)}
                                                className="pl-8 pr-3 py-1.5 w-full text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400"
                                            />
                                        </div>

                                        {/* List of Orders */}
                                        {loadingOrders ? (
                                            <div className="py-8 text-center text-zinc-500 text-xs">
                                                <RefreshCw className="animate-spin h-4 w-4 mx-auto mb-1.5 text-zinc-400" />
                                                Loading orders...
                                            </div>
                                        ) : filteredOrders.length === 0 ? (
                                            <div className="py-8 text-center text-zinc-455 text-[11px] px-4">
                                                {ordersSearchQuery.trim() !== '' 
                                                    ? 'No matching orders found.' 
                                                    : 'No matching orders found automatically. Search by order number or name above.'}
                                            </div>
                                        ) : (
                                            filteredOrders.map((order) => {
                                                const formattedDate = order.order_date 
                                                    ? new Date(order.order_date).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                                    : ''
                                                
                                                // Map Daraz status to Tailwind/Vanilla CSS badges
                                                const status = order.order_status?.toLowerCase() || 'pending'
                                                let statusColor = 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                                                if (['delivered', 'completed'].includes(status)) {
                                                    statusColor = 'bg-green-50 text-green-700 border-green-200/50 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30'
                                                } else if (['shipped', 'ready_to_ship', 'packed'].includes(status)) {
                                                    statusColor = 'bg-orange-50 text-orange-600 border-orange-200/50 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30'
                                                } else if (['canceled', 'cancelled', 'cancel', 'failed'].includes(status)) {
                                                    statusColor = 'bg-red-50 text-red-650 border-red-200/50 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30'
                                                }

                                                return (
                                                    <div 
                                                        key={order.id} 
                                                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm p-3 space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300 animate-fadeIn"
                                                    >
                                                        {/* Header: Status and ID */}
                                                        <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusColor}`}>
                                                                {order.order_status}
                                                            </span>
                                                            <button 
                                                                onClick={() => handleCopyText(order.order_number)}
                                                                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-blue-500 font-medium transition-colors"
                                                                title="Copy Order ID"
                                                            >
                                                                <span>ID: {order.order_number}</span>
                                                                <Copy size={10} />
                                                            </button>
                                                        </div>

                                                        {/* Items */}
                                                        <div className="space-y-2">
                                                            {order.daraz_order_items?.map((item: any) => {
                                                                const imgUrl = item.products?.image_url
                                                                return (
                                                                    <div key={item.id} className="flex gap-2">
                                                                        {/* Product image */}
                                                                        <div className="h-10 w-10 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200/50 dark:border-zinc-750 flex items-center justify-center shrink-0 overflow-hidden">
                                                                            {imgUrl ? (
                                                                                <img 
                                                                                    src={imgUrl} 
                                                                                    alt={item.product_name} 
                                                                                    className="h-full w-full object-cover" 
                                                                                />
                                                                            ) : (
                                                                                <ShoppingBag size={14} className="text-zinc-400" />
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {/* Product details */}
                                                                        <div className="flex-1 min-w-0">
                                                                            <h4 className="font-medium text-zinc-800 dark:text-zinc-200 text-[11px] leading-tight line-clamp-2" title={item.product_name}>
                                                                                {item.product_name}
                                                                            </h4>
                                                                            <div className="flex justify-between items-center mt-1 text-[10px] text-zinc-400">
                                                                                <span>Qty: {item.quantity}</span>
                                                                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                                                                    NPR {item.amount}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>

                                                        {/* Order details summary */}
                                                        <div className="pt-2 border-t border-zinc-150 dark:border-zinc-800/80 space-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                                                            <div className="flex justify-between">
                                                                <span>Order time:</span>
                                                                <span>{formattedDate}</span>
                                                            </div>
                                                            {order.tracking_number && (
                                                                <div className="flex justify-between">
                                                                    <span>Logistics:</span>
                                                                    <span className="text-blue-500 dark:text-blue-400 font-medium">
                                                                        In Transit ({order.tracking_number.split(',')[0]})
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between items-baseline pt-1">
                                                                <span className="text-xs font-bold text-zinc-850 dark:text-zinc-200">Total Price:</span>
                                                                <span className="text-sm font-extrabold text-orange-500 dark:text-orange-400">
                                                                    NPR {order.price}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div className="flex gap-2 pt-1">
                                                            <button 
                                                                onClick={() => handleSendGuideLink(order.order_number, order.order_status, order.tracking_number)}
                                                                className="flex-1 py-1.5 border border-orange-500 text-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/10 text-[10px] font-bold rounded transition-colors text-center"
                                                            >
                                                                Send Guide Link
                                                            </button>
                                                            <button 
                                                                onClick={() => handleSendOrderCard(order.order_id)}
                                                                className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold rounded transition-colors text-center shadow-sm"
                                                            >
                                                                Send
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                )}

                                {activeRightTab === 'product' && (
                                    <div className="py-12 text-center text-zinc-400 text-xs">
                                        <ShoppingBag size={24} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                                        <span>No products shared yet.</span>
                                    </div>
                                )}

                                {activeRightTab === 'voucher' && (
                                    <div className="py-12 text-center text-zinc-400 text-xs">
                                        <Tag size={24} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                                        <span>No vouchers available for this store.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* ----------------- SETTINGS & AUTOMATION WORKSPACE ----------------- */
                <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-6 space-y-6">
                    {/* Store status connection toggle and AI toggles */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Store configuration cards */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-5">
                            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                <Cpu className="text-blue-600" size={20} />
                                <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">AI & Connection Controls</h2>
                            </div>

                            <div className="space-y-4">
                                {/* Connection Toggle */}
                                <div className="flex justify-between items-center p-3.5 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg border border-zinc-200/50 dark:border-zinc-700/30">
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Chat Connection Status</h3>
                                        <p className="text-[11px] text-zinc-500">Connect or disconnect this store account from messaging sync entirely.</p>
                                    </div>
                                    <button
                                        onClick={() => handleSaveSettings({ messaging_enabled: !currentStoreSettings.messaging_enabled })}
                                        disabled={savingSettings}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all border ${
                                            currentStoreSettings.messaging_enabled !== false
                                                ? 'bg-green-500/10 border-green-500/20 text-green-600 hover:bg-green-500/20'
                                                : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                                        }`}
                                    >
                                        {currentStoreSettings.messaging_enabled !== false ? 'CONNECTED' : 'DISCONNECTED'}
                                    </button>
                                </div>

                                {/* AI Toggle */}
                                <div className="flex justify-between items-center p-3.5 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg border border-zinc-200/50 dark:border-zinc-700/30">
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Gemini AI Auto-Reply</h3>
                                        <p className="text-[11px] text-zinc-500">Automatically answer buyer FAQs using generative AI database checks.</p>
                                    </div>
                                    <button
                                        onClick={() => handleSaveSettings({ ai_enabled: !currentStoreSettings.ai_enabled })}
                                        disabled={savingSettings || currentStoreSettings.messaging_enabled === false}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all border ${
                                            currentStoreSettings.ai_enabled
                                                ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                                                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
                                        }`}
                                    >
                                        {currentStoreSettings.ai_enabled ? 'AI ACTIVE' : 'AI INACTIVE'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Order Automation configuration */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                <ShoppingBag className="text-indigo-600" size={20} />
                                <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">New Order Automation</h2>
                            </div>

                            <div className="space-y-4">
                                {/* Toggle switch */}
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Auto-Message on New Order</h3>
                                        <p className="text-[11px] text-zinc-500">Queue a greeting + follow invitation card when a new order is received.</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={currentStoreSettings.auto_reply_on_new_order || false}
                                        onChange={(e) => handleSaveSettings({ auto_reply_on_new_order: e.target.checked })}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300 rounded cursor-pointer"
                                    />
                                </div>

                                {/* Delay Minutes input */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock size={12} /> Message Delay Time (Minutes)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="60"
                                        value={currentStoreSettings.new_order_delay_minutes ?? 1}
                                        onChange={(e) => handleSaveSettings({ new_order_delay_minutes: parseInt(e.target.value) || 0 })}
                                        className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Text Template */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                        Greeting Text Template
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={currentStoreSettings.new_order_template || ''}
                                        onChange={(e) => setStoreSettings(prev => ({
                                            ...prev,
                                            [activeStoreId]: { ...prev[activeStoreId], new_order_template: e.target.value }
                                        }))}
                                        onBlur={() => handleSaveSettings({ new_order_template: currentStoreSettings.new_order_template })}
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-100"
                                        placeholder="Enter the template to send to new buyers..."
                                    />
                                    <p className="text-[10px] text-zinc-400">Note: The &quot;Follow Our Store&quot; invitation button will be appended automatically below this message.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Automation Rules match configuration */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Rules list */}
                        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Keyword & Exact Match Rules</h2>
                                <p className="text-xs text-zinc-500">View current matching rule triggers that send instant automated template replies.</p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                                    <thead>
                                        <tr className="text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                            <th className="pb-3 pr-4">Type</th>
                                            <th className="pb-3 px-4">Pattern (Trigger)</th>
                                            <th className="pb-3 px-4">Reply Content</th>
                                            <th className="pb-3 pl-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                                        {rules.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-8 text-center text-zinc-500 text-xs">
                                                    No match rules created yet. Add one on the right to start automating!
                                                </td>
                                            </tr>
                                        ) : (
                                            rules.map((rule) => (
                                                <tr key={rule.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/10">
                                                    <td className="py-3 pr-4 font-semibold text-zinc-800 dark:text-zinc-200">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                            rule.match_type === 'exact' 
                                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400' 
                                                                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400'
                                                        }`}>
                                                            {rule.match_type.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 font-bold text-zinc-700 dark:text-zinc-300">&quot;{rule.pattern}&quot;</td>
                                                    <td className="py-3 px-4 text-zinc-500 max-w-xs truncate">{rule.reply_content}</td>
                                                    <td className="py-3 pl-4 text-right">
                                                        <button
                                                            onClick={() => handleDeleteRule(rule.id)}
                                                            className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                                                            title="Delete Rule"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Add new rule form */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Add Automation Rule</h2>
                                <p className="text-xs text-zinc-500">Define a new pattern to match and instant reply template.</p>
                            </div>

                            <form onSubmit={handleAddRule} className="space-y-4">
                                {/* Rule Type */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Match Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setNewRuleType('keyword')}
                                            className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                                newRuleType === 'keyword'
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                            }`}
                                        >
                                            Keyword Match
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewRuleType('exact')}
                                            className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                                newRuleType === 'exact'
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                            }`}
                                        >
                                            Exact Match
                                        </button>
                                    </div>
                                </div>

                                {/* Trigger Pattern */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Trigger Pattern</label>
                                    <input
                                        type="text"
                                        placeholder={newRuleType === 'exact' ? 'e.g., hello' : 'e.g., return'}
                                        value={newRulePattern}
                                        onChange={(e) => setNewRulePattern(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-850 dark:text-zinc-100"
                                    />
                                    <p className="text-[10px] text-zinc-400">
                                        {newRuleType === 'exact' 
                                            ? 'Triggers only if message is exactly equal to this text.' 
                                            : 'Triggers if trigger phrase is found anywhere inside message.'
                                        }
                                    </p>
                                </div>

                                {/* Reply Text */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Response Message</label>
                                    <textarea
                                        rows={4}
                                        placeholder="Write response message here..."
                                        value={newRuleReply}
                                        onChange={(e) => setNewRuleReply(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-850 dark:text-zinc-100"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs py-2.5 rounded-lg shadow-sm transition-all active:scale-[0.98]"
                                >
                                    Add Rule
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Daraz Chat Account Connections Modal */}
            <Dialog open={showAccountModal} onOpenChange={setShowAccountModal}>
                <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <DialogHeader>
                        <DialogTitle className="text-zinc-900 dark:text-zinc-100 flex items-center gap-2 text-lg font-bold">
                            <Store className="text-orange-500" /> Daraz Chat Account
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Authorize each store for the <strong>Bagmati Traders IM Chat</strong> app (AppKey: 505350) to enable automated messaging and AI replies.
                        </p>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50 dark:bg-zinc-950 max-h-64 overflow-y-auto">
                            {stores.length === 0 ? (
                                <p className="p-4 text-center text-xs text-zinc-500">No stores found.</p>
                            ) : (
                                stores.map(store => {
                                    const isConnected = connectedChatStores.includes(store.id)
                                    const isConnectingThis = connectingStoreId === store.id
                                    return (
                                        <div key={store.id} className="p-4 flex items-center justify-between gap-4 bg-white dark:bg-zinc-900">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-zinc-850 dark:text-zinc-200 truncate">{store.company_name}</p>
                                                <p className="text-[11px] text-zinc-500 truncate">{store.seller_account}</p>
                                            </div>
                                            <button
                                                disabled={isConnectingThis}
                                                onClick={() => handleConnectChat(store.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0 ${
                                                    isConnected
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-100'
                                                        : 'bg-blue-600 hover:bg-blue-700 text-white font-bold'
                                                }`}
                                            >
                                                {isConnectingThis ? 'Redirecting...' : isConnected ? 'Connected (Re-Auth)' : 'Connect Chat'}
                                            </button>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
