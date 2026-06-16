'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import axios from 'axios'

export interface ChatSettings {
    store_id: string
    messaging_enabled: boolean
    ai_enabled: boolean
    auto_reply_on_new_order: boolean
    new_order_template: string
    new_order_delay_minutes: number
    created_at?: string
    updated_at?: string
}

const API_URL = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest'

// Sign Daraz API Requests helper
function signRequest(apiName: string, params: Record<string, unknown>, appSecret: string) {
    const keys = Object.keys(params).sort()
    let str = apiName
    keys.forEach(key => {
        str += key + String(params[key])
    })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

// 1. Get Store Tokens & App Config
async function getStoreTokenAndSecret(storeId: string) {
    const appKey = process.env.NEXT_PUBLIC_DARAZ_CHAT_APP_KEY?.trim()
    const appSecret = process.env.DARAZ_CHAT_APP_SECRET?.trim()

    if (!appKey || !appSecret) {
        throw new Error('Daraz Chat API keys configuration missing on server env')
    }

    const supabase = await createAdminClient()
    const { data: tokenData, error } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .eq('app_type', 'chat')
        .maybeSingle()

    if (error || !tokenData) {
        throw new Error(`No active chat connection or token found for store: ${storeId}. Please connect your Daraz account for Chat.`)
    }

    return { appKey, appSecret, accessToken: tokenData.access_token }
}

// 2. Fetch/Sync Sessions from Daraz API
export async function syncDarazChatSessions(storeId: string) {
    try {
        const { appKey, appSecret, accessToken } = await getStoreTokenAndSecret(storeId)
        const supabase = await createAdminClient()

        // Verify if store messaging is enabled
        const settings = await getChatSettings(storeId)
        if (!settings.messaging_enabled) {
            console.log(`[ChatSync] Messaging is disabled for store: ${storeId}. Skipping sync.`)
            return { success: false, reason: 'Disconnected' }
        }

        const timestamp = Date.now().toString()
        const params: Record<string, unknown> = {
            app_key: appKey,
            access_token: accessToken,
            timestamp,
            sign_method: 'sha256',
            start_time: (Date.now() - 30 * 24 * 60 * 60 * 1000).toString(), // past 30 days
            page_size: '50'
        }

        const apiPath = '/im/session/list'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log(`[ChatSync] Syncing sessions for store ${storeId}...`)
        const response = await axios.get(`${API_URL}${apiPath}`, { params })

        if (response.data.code !== "0" && response.data.code !== 0) {
            throw new Error(`Daraz API Error: ${response.data.message || response.data.msg}`)
        }

        const sessionList = response.data.data?.session_list || []
        console.log(`[ChatSync] Retrieved ${sessionList.length} sessions from Daraz.`)

        for (const session of sessionList) {
            // Upsert session details
            const sessionPayload = {
                session_id: session.session_id,
                store_id: storeId,
                buyer_id: String(session.buyer_id),
                title: session.title || `Buyer ${session.buyer_id}`,
                head_url: session.head_url || null,
                unread_count: parseInt(session.unread_count || '0'),
                last_message_id: session.last_message_id || null,
                last_message_time: session.last_message_time ? new Date(parseInt(session.last_message_time)).toISOString() : null,
                last_message_summary: session.summary || null,
                updated_at: new Date().toISOString()
            }

            const { error: sessionError } = await supabase
                .from('daraz_chat_sessions')
                .upsert(sessionPayload, { onConflict: 'session_id' })

            if (sessionError) {
                console.error(`[ChatSync] Error saving session ${session.session_id}:`, sessionError.message)
                continue
            }

            // Sync messages for this session
            await syncDarazChatMessages(storeId, session.session_id)
        }

        revalidatePath('/dashboard/chat-ai')
        return { success: true, count: sessionList.length }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[ChatSync] Session sync failed for store ${storeId}:`, errorMessage)
        return { success: false, reason: errorMessage }
    }
}

// 3. Fetch/Sync Messages for a single Session from Daraz API
export async function syncDarazChatMessages(storeId: string, sessionId: string) {
    try {
        const { appKey, appSecret, accessToken } = await getStoreTokenAndSecret(storeId)
        const supabase = await createAdminClient()

        const timestamp = Date.now().toString()
        const params: Record<string, unknown> = {
            app_key: appKey,
            access_token: accessToken,
            timestamp,
            sign_method: 'sha256',
            session_id: sessionId,
            start_time: (Date.now() - 3 * 24 * 60 * 60 * 1000).toString(), // past 3 days (due to 48h cleanup)
            page_size: '50'
        }

        const apiPath = '/im/message/list'
        params.sign = signRequest(apiPath, params, appSecret)

        const response = await axios.get(`${API_URL}${apiPath}`, { params })

        if (response.data.code !== "0" && response.data.code !== 0) {
            throw new Error(`Daraz API Error: ${response.data.message || response.data.msg}`)
        }

        const messageList = response.data.data?.message_list || []
        
        let newMessagesCached = 0
        for (const msg of messageList) {
            const sendTime = msg.send_time ? new Date(parseInt(String(msg.send_time))).toISOString() : new Date().toISOString()
            
            // Check if message already exists to avoid overwriting user/system tags
            const { data: existingMsg } = await supabase
                .from('daraz_chat_messages')
                .select('message_id, tags')
                .eq('message_id', msg.message_id)
                .maybeSingle()

            if (existingMsg) continue // Skip if already cached

            const msgPayload = {
                message_id: msg.message_id,
                session_id: sessionId,
                from_account_id: String(msg.from_account_id),
                from_account_type: String(msg.from_account_type),
                to_account_id: String(msg.to_account_id),
                to_account_type: String(msg.to_account_type),
                content: msg.content,
                template_id: String(msg.template_id || '1'),
                send_time: sendTime,
                auto_reply: msg.auto_reply === 'true' || msg.auto_reply === true,
                tags: []
            }

            const { error: msgError } = await supabase
                .from('daraz_chat_messages')
                .insert(msgPayload)

            if (msgError) {
                console.error(`[ChatSync] Error saving message ${msg.message_id}:`, msgError.message)
            } else {
                newMessagesCached++

                // Trigger AI or Keyword auto-reply process ONLY if message is:
                // - Sent by buyer (from_account_type = '2')
                // - Received recently (last 5 minutes)
                const isBuyer = String(msg.from_account_type) === '2'
                const isRecent = (Date.now() - parseInt(String(msg.send_time))) < 5 * 60 * 1000
                if (isBuyer && isRecent) {
                    await processIncomingMessageAutoReply(storeId, sessionId, {
                        content: String(msg.content),
                        from_account_type: String(msg.from_account_type),
                        send_time: String(msg.send_time)
                    })
                }
            }
        }

        return { success: true, count: newMessagesCached }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[ChatSync] Message sync failed for session ${sessionId}:`, errorMessage)
        return { success: false, error: errorMessage }
    }
}

// 4. Send Chat Message to Daraz
export async function sendChatMessage(
    storeId: string,
    sessionId: string,
    templateId: string,
    txt?: string,
    itemId?: string,
    orderId?: string,
    autoReply = false
) {
    try {
        const { appKey, appSecret, accessToken } = await getStoreTokenAndSecret(storeId)
        const supabase = await createAdminClient()

        const timestamp = Date.now().toString()
        const params: Record<string, unknown> = {
            app_key: appKey,
            access_token: accessToken,
            timestamp,
            sign_method: 'sha256',
            session_id: sessionId,
            template_id: templateId
        }

        if (templateId === '1' && txt) params.txt = txt
        if (templateId === '10006' && itemId) params.item_id = itemId
        if (templateId === '10007' && orderId) params.order_id = orderId

        const apiPath = '/im/message/send'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log(`[ChatSync] Sending message (template ${templateId}) to session ${sessionId}...`)
        const response = await axios.post(`${API_URL}${apiPath}`, null, { params })

        if (response.data.code !== "0" && response.data.code !== 0) {
            throw new Error(`Daraz API Error: ${response.data.message || response.data.msg}`)
        }

        const msgData = response.data.data
        const messageId = msgData?.message_id || `local_${Date.now()}`

        // Save sent message locally
        const { data: session } = await supabase
            .from('daraz_chat_sessions')
            .select('buyer_id')
            .eq('session_id', sessionId)
            .single()

        const msgPayload = {
            message_id: messageId,
            session_id: sessionId,
            from_account_id: 'seller', // identifier
            from_account_type: '1', // Seller
            to_account_id: session?.buyer_id || 'buyer',
            to_account_type: '2', // Buyer
            content: templateId === '1' ? JSON.stringify({ txt }) : JSON.stringify({ templateId, itemId, orderId }),
            template_id: templateId,
            send_time: new Date().toISOString(),
            auto_reply: autoReply,
            tags: []
        }

        await supabase.from('daraz_chat_messages').insert(msgPayload)

        // Update session last message summary
        await supabase
            .from('daraz_chat_sessions')
            .update({
                last_message_id: messageId,
                last_message_time: new Date().toISOString(),
                last_message_summary: templateId === '1' ? txt : 'Interactive Template Message'
            })
            .eq('session_id', sessionId)

        revalidatePath('/dashboard/chat-ai')
        return { success: true, messageId }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[ChatSync] Send message failed:`, errorMessage)
        throw new Error(errorMessage || 'Failed to send message')
    }
}

// 5. Open Session proactively using Order ID
export async function openSessionByOrderId(storeId: string, orderId: string): Promise<string | null> {
    try {
        const { appKey, appSecret, accessToken } = await getStoreTokenAndSecret(storeId)
        
        const timestamp = Date.now().toString()
        const params: Record<string, unknown> = {
            app_key: appKey,
            access_token: accessToken,
            timestamp,
            sign_method: 'sha256',
            order_id: String(orderId)
        }

        const apiPath = '/im/session/open'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log(`[ChatSync] Opening conversation for Order ID: ${orderId}...`)
        const response = await axios.post(`${API_URL}${apiPath}`, null, { params })

        if (response.data.code !== "0" && response.data.code !== 0) {
            throw new Error(`Daraz API Error: ${response.data.message || response.data.msg}`)
        }

        return response.data.session_id || null
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[ChatSync] Open session failed for order ${orderId}:`, errorMessage)
        return null
    }
}

// 6. Manage Settings
export async function getChatSettings(storeId: string) {
    const supabase = await createAdminClient()
    const { data } = await supabase
        .from('daraz_chat_settings')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle()

    if (!data) {
        // Create default settings
        const defaultSettings = {
            store_id: storeId,
            messaging_enabled: true,
            ai_enabled: false,
            auto_reply_on_new_order: false,
            new_order_template: 'Thank you for your order! We have received it and are preparing it. Please click below to follow our store for the latest updates!',
            new_order_delay_minutes: 1
        }
        const { data: inserted } = await supabase
            .from('daraz_chat_settings')
            .insert(defaultSettings)
            .select()
            .single()
        return inserted || defaultSettings
    }
    return data
}

export async function updateChatSettings(storeId: string, payload: Partial<ChatSettings>) {
    const supabase = await createAdminClient()
    const { error } = await supabase
        .from('daraz_chat_settings')
        .update(payload)
        .eq('store_id', storeId)

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/chat-ai')
    return { success: true }
}

// 7. Manage Message Tags
export async function updateMessageTags(messageId: string, tags: string[]) {
    const supabase = await createAdminClient()
    const { error } = await supabase
        .from('daraz_chat_messages')
        .update({ tags })
        .eq('message_id', messageId)

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/chat-ai')
    return { success: true }
}

// 8. Manage Rules (Keyword / Exact match templates)
export async function getChatRules(storeId: string) {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('daraz_chat_rules')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function addChatRule(storeId: string, rule: { match_type: 'exact' | 'keyword', pattern: string, reply_content: string }) {
    const supabase = await createAdminClient()
    const { error } = await supabase
        .from('daraz_chat_rules')
        .insert({
            store_id: storeId,
            match_type: rule.match_type,
            pattern: rule.pattern.toLowerCase().trim(),
            reply_content: rule.reply_content
        })

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/chat-ai')
    return { success: true }
}

export async function deleteChatRule(ruleId: string) {
    const supabase = await createAdminClient()
    const { error } = await supabase
        .from('daraz_chat_rules')
        .delete()
        .eq('id', ruleId)

    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/chat-ai')
    return { success: true }
}

// 9. Auto Reply processing (AI & Keyword Matching rules)
export interface DarazMessage {
    content: string
    from_account_type: string | number
    send_time: string | number
}

export async function processIncomingMessageAutoReply(storeId: string, sessionId: string, msg: DarazMessage) {
    try {
        const supabase = await createAdminClient()
        const settings = await getChatSettings(storeId)

        // Parse incoming message content
        let userText = ''
        try {
            const parsed = JSON.parse(msg.content)
            userText = parsed.txt || parsed.content || msg.content || ''
        } catch {
            userText = msg.content || ''
        }

        const cleanText = userText.toLowerCase().trim()
        if (!cleanText) return

        // A. Check Exact Matches
        const rules = await getChatRules(storeId)
        const exactMatch = rules.find(r => r.match_type === 'exact' && cleanText === r.pattern.toLowerCase().trim())
        if (exactMatch) {
            console.log(`[AutoReply] Exact match found for: "${userText}" -> replying: "${exactMatch.reply_content}"`)
            await sendChatMessage(storeId, sessionId, '1', exactMatch.reply_content, undefined, undefined, true)
            return
        }

        // B. Check Keyword Matches
        const keywordMatch = rules.find(r => r.match_type === 'keyword' && cleanText.includes(r.pattern.toLowerCase().trim()))
        if (keywordMatch) {
            console.log(`[AutoReply] Keyword match found in: "${userText}" -> replying: "${keywordMatch.reply_content}"`)
            await sendChatMessage(storeId, sessionId, '1', keywordMatch.reply_content, undefined, undefined, true)
            return
        }

        // C. AI Auto-Reply (Gemini API)
        if (settings.ai_enabled) {
            const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
            if (!apiKey) {
                console.warn('[AutoReply] AI enabled but GEMINI_API_KEY is missing in environment.')
                return
            }

            console.log(`[AutoReply] Triggering Gemini AI for message: "${userText}"`)

            // Context gathering: Fetch some active products to give stock context
            const { data: products } = await supabase
                .from('products')
                .select('product_name, seller_sku1, seller_sku2, is_deleted')
                .eq('is_deleted', false)
                .limit(15)

            let productsContext = 'Here is a list of some items we have in stock:\n'
            if (products && products.length > 0) {
                productsContext += products.map(p => `- ${p.product_name} (SKU: ${p.seller_sku1 || 'N/A'})`).join('\n')
            } else {
                productsContext += 'No products inventory loaded.'
            }

            // Fetch last 5 messages in this session for conversation memory
            const { data: recentMsgs } = await supabase
                .from('daraz_chat_messages')
                .select('from_account_type, content, send_time')
                .eq('session_id', sessionId)
                .order('send_time', { ascending: false })
                .limit(5)

            let historyContext = ''
            if (recentMsgs && recentMsgs.length > 0) {
                const sortedMsgs = [...recentMsgs].reverse()
                historyContext = sortedMsgs.map(m => {
                    let text = m.content
                    try {
                        const p = JSON.parse(m.content)
                        text = p.txt || m.content
                    } catch {}
                    const sender = m.from_account_type === '1' ? 'Seller (You)' : 'Buyer (Customer)'
                    return `[${sender}]: ${text}`
                }).join('\n')
            }

            const systemPrompt = `You are an automated AI Customer Service Assistant for our online store on Daraz.
Your goal is to answer the customer's questions politely, accurately, and concisely. Keep responses short (under 2-3 sentences) because customers read them on mobile chat.

Store Inventory Context:
${productsContext}

Recent Conversation History:
${historyContext}
[Buyer (Customer)]: ${userText}

Generate a friendly response in English or Nepali based on the customer's language. Do not make up facts. If you do not know the answer (e.g. tracking code details not in context), politely tell the customer that a human support agent will review and reply shortly.
Response:`

            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                    contents: [{
                        parts: [{ text: systemPrompt }]
                    }]
                },
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            )

            const replyText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
            if (replyText && replyText.trim()) {
                const cleanReply = replyText.replace(/AI Assistant:/gi, '').trim()
                console.log(`[AutoReply] AI response generated: "${cleanReply}"`)
                
                await sendChatMessage(storeId, sessionId, '1', cleanReply, undefined, undefined, true)
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[AutoReply] Auto-reply processor encountered an error:`, errorMessage)
    }
}
