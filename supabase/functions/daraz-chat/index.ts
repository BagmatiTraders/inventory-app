import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 1. Deno Cryptographic Signature Verification
async function verifySignature(appKey: string, body: string, appSecret: string, receivedSignature: string): Promise<boolean> {
    const base = appKey + body;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(appSecret);
    
    const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(base)
    );
    
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    
    return expectedSignature === receivedSignature.toLowerCase();
}

// Helper: Sign Daraz API Requests
async function signRequest(apiName: string, params: Record<string, any>, appSecret: string): Promise<string> {
    const keys = Object.keys(params).sort();
    let str = apiName;
    keys.forEach(key => {
        str += key + String(params[key]);
    });
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(appSecret);
    const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(str)
    );
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Helper: Parse message text summary
function parseSummary(content: string): string {
    try {
        const parsed = JSON.parse(content);
        return parsed.txt || parsed.content || content;
    } catch {
        return content;
    }
}

// Helper: Parse timestamp securely to milliseconds
function parseTimestamp(ts: string | number | undefined): string {
    if (!ts) return new Date().toISOString();
    const num = parseInt(String(ts));
    if (isNaN(num)) return new Date().toISOString();
    // If it is in seconds (10 digits), convert to milliseconds
    const ms = num < 9999999999 ? num * 1000 : num;
    return new Date(ms).toISOString();
}

// 2. Call Daraz API to Send Message
async function sendDarazMessage(
    storeId: string,
    sessionId: string,
    txt: string,
    supabase: any,
    appKey: string,
    appSecret: string
) {
    const { data: tokenData, error: tokenError } = await supabase
        .from('daraz_api_tokens')
        .select('access_token')
        .eq('store_id', storeId)
        .eq('app_type', 'chat')
        .maybeSingle();

    if (tokenError || !tokenData) {
        console.error(`[EdgeFunction] No active token found for store: ${storeId}`);
        return;
    }

    const accessToken = tokenData.access_token;
    const API_URL = 'https://api.daraz.com.np/rest';
    const timestamp = Date.now().toString();

    const params: Record<string, any> = {
        app_key: appKey,
        access_token: accessToken,
        timestamp,
        sign_method: 'sha256',
        session_id: sessionId,
        template_id: '1',
        txt: txt
    };

    const apiPath = '/im/message/send';
    params.sign = await signRequest(apiPath, params, appSecret);

    console.log(`[EdgeFunction] Sending auto-reply to Daraz session ${sessionId}...`);
    const queryStr = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}${apiPath}?${queryStr}`, {
        method: 'POST'
    });

    const resData = await response.json();
    if (resData.code !== "0" && resData.code !== 0) {
        console.error(`[EdgeFunction] Daraz Send API error:`, resData);
        return;
    }

    const messageId = resData.data?.message_id || `local_${Date.now()}`;

    // Get session's buyer_id
    const { data: session } = await supabase
        .from('daraz_chat_sessions')
        .select('buyer_id')
        .eq('session_id', sessionId)
        .maybeSingle();

    // Save sent message locally
    const msgPayload = {
        message_id: messageId,
        session_id: sessionId,
        from_account_id: 'seller',
        from_account_type: '2', // Seller
        to_account_id: session?.buyer_id || 'buyer',
        to_account_type: '1', // Buyer
        content: JSON.stringify({ txt }),
        template_id: '1',
        send_time: new Date().toISOString(),
        auto_reply: true,
        tags: []
    };

    await supabase.from('daraz_chat_messages').insert(msgPayload);

    // Update session summary
    await supabase
        .from('daraz_chat_sessions')
        .update({
            last_message_id: messageId,
            last_message_time: new Date().toISOString(),
            last_message_summary: txt
        })
        .eq('session_id', sessionId);

    console.log(`[EdgeFunction] Auto-reply message successfully sent and saved.`);
}

// 3. AI Reply Generation (Gemini API)
async function handleAiAutoReply(
    storeId: string,
    sessionId: string,
    userText: string,
    supabase: any,
    appKey: string,
    appSecret: string,
    geminiApiKey: string
) {
    console.log(`[EdgeFunction] Triggering Gemini AI for message: "${userText}"`);

    // Fetch active products context
    const { data: products } = await supabase
        .from('products')
        .select('product_name, seller_sku1, seller_sku2, is_deleted')
        .eq('is_deleted', false)
        .limit(15);

    let productsContext = 'Here is a list of some items we have in stock:\n';
    if (products && products.length > 0) {
        productsContext += products.map((p: any) => `- ${p.product_name} (SKU: ${p.seller_sku1 || 'N/A'})`).join('\n');
    } else {
        productsContext += 'No products inventory loaded.';
    }

    // Fetch recent message history
    const { data: recentMsgs } = await supabase
        .from('daraz_chat_messages')
        .select('from_account_type, content, send_time')
        .eq('session_id', sessionId)
        .order('send_time', { ascending: false })
        .limit(5);

    let historyContext = '';
    if (recentMsgs && recentMsgs.length > 0) {
        const sortedMsgs = [...recentMsgs].reverse();
        historyContext = sortedMsgs.map((m: any) => {
            let text = m.content;
            try {
                const p = JSON.parse(m.content);
                text = p.txt || m.content;
            } catch {}
            const sender = m.from_account_type === '2' ? 'Seller (You)' : 'Buyer (Customer)';
            return `[${sender}]: ${text}`;
        }).join('\n');
    }

    const systemPrompt = `You are an automated AI Customer Service Assistant for our online store on Daraz.
Your goal is to answer the customer's questions politely, accurately, and concisely. Keep responses short (under 2-3 sentences) because customers read them on mobile chat.

Store Inventory Context:
${productsContext}

Recent Conversation History:
${historyContext}
[Buyer (Customer)]: ${userText}

Generate a friendly response in English or Nepali based on the customer's language. Do not make up facts. If you do not know the answer (e.g. tracking code details not in context), politely tell the customer that a human support agent will review and reply shortly.
Response:`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: systemPrompt }]
                    }]
                })
            }
        );

        const resData = await response.json();
        const replyText = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (replyText && replyText.trim()) {
            const cleanReply = replyText.replace(/AI Assistant:/gi, '').trim();
            console.log(`[EdgeFunction] AI response generated: "${cleanReply}"`);
            await sendDarazMessage(storeId, sessionId, cleanReply, supabase, appKey, appSecret);
        }
    } catch (e) {
        console.error('[EdgeFunction] AI generation failed:', e);
    }
}

// 4. Main Router Function
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawBody = await req.text();
    const authorization = req.headers.get('authorization');

    // Handle empty test pings
    if (!rawBody || rawBody.trim() === '') {
        console.log('[EdgeFunction] Received empty body, acknowledging.');
        return new Response(JSON.stringify({ success: true, message: 'Empty body acknowledged' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (!authorization) {
        console.error('[EdgeFunction] Missing authorization signature header');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const appKey = Deno.env.get('DARAZ_APP_KEY')?.trim() || '';
    const appSecret = Deno.env.get('DARAZ_APP_SECRET')?.trim() || '';
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim() || '';

    if (!appKey || !appSecret) {
        console.error('[EdgeFunction] Environment credentials missing (DARAZ_APP_KEY / DARAZ_APP_SECRET)');
        return new Response(JSON.stringify({ error: 'Server configuration error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Verify HMAC-SHA256 signature
    const isValid = await verifySignature(appKey, rawBody, appSecret, authorization || '');
    if (!isValid) {
        console.error('[EdgeFunction] Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const payload = JSON.parse(rawBody);
    const { message_type, data, seller_id } = payload;

    // We only process message_type 2 (Instant Messaging/Chat)
    if (message_type !== 2 || !data) {
        console.log(`[EdgeFunction] Ignoring message_type: ${message_type} (Next.js backend handles orders)`);
        return new Response(JSON.stringify({ success: true, message: 'Non-messaging type ignored' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Map seller_id to database store_id
    const { data: store, error: storeError } = await supabase
        .from('online_stores')
        .select('id, seller_account')
        .eq('seller_id', String(seller_id))
        .maybeSingle();

    if (storeError || !store) {
        console.error(`[EdgeFunction] Store not found for seller_id: "${seller_id}"`);
        return new Response(JSON.stringify({ success: true, message: 'Store not found' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`[EdgeFunction] Matched Store: ${store.seller_account} (${store.id})`);

    // Fetch Chat Settings
    const { data: settings } = await supabase
        .from('daraz_chat_settings')
        .select('*')
        .eq('store_id', store.id)
        .maybeSingle();

    if (settings && settings.messaging_enabled === false) {
        console.log(`[EdgeFunction] Messaging disabled for store: ${store.id}`);
        return new Response(JSON.stringify({ success: true, message: 'Store chat disabled' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Determine sender roles
    const fromAccountType = String(data.from_account_type); // '2' = seller, '1' = buyer
    const isBuyer = fromAccountType === '1' || fromAccountType === 'buyer';
    const buyerId = isBuyer ? String(data.from_account_id) : String(data.to_account_id);

    // Retrieve or create session
    const { data: existingSession } = await supabase
        .from('daraz_chat_sessions')
        .select('title, unread_count')
        .eq('session_id', data.session_id)
        .maybeSingle();

    const sessionPayload = {
        session_id: data.session_id,
        store_id: store.id,
        buyer_id: buyerId,
        title: existingSession?.title || `Buyer ${buyerId}`,
        unread_count: isBuyer ? (existingSession?.unread_count || 0) + 1 : 0,
        last_message_id: data.message_id,
        last_message_time: data.send_time ? parseTimestamp(data.send_time) : new Date().toISOString(),
        last_message_summary: data.content ? parseSummary(data.content) : null,
        updated_at: new Date().toISOString()
    };

    await supabase.from('daraz_chat_sessions').upsert(sessionPayload, { onConflict: 'session_id' });

    // Store Message details
    const msgPayload = {
        message_id: data.message_id,
        session_id: data.session_id,
        from_account_id: String(data.from_account_id),
        from_account_type: fromAccountType,
        to_account_id: String(data.to_account_id),
        to_account_type: String(data.to_account_type),
        content: data.content,
        template_id: String(data.template_id || '1'),
        send_time: data.send_time ? parseTimestamp(data.send_time) : new Date().toISOString(),
        auto_reply: false,
        tags: []
    };

    await supabase.from('daraz_chat_messages').upsert(msgPayload, { onConflict: 'message_id' });
    console.log(`[EdgeFunction] Saved incoming message: ${data.message_id}`);

    // If buyer sent the message, run automation check
    if (isBuyer) {
        const { data: rules } = await supabase
            .from('daraz_chat_rules')
            .select('*')
            .eq('store_id', store.id);

        let userText = '';
        try {
            const parsed = JSON.parse(data.content);
            userText = parsed.txt || parsed.content || data.content || '';
        } catch {
            userText = data.content || '';
        }
        const cleanText = userText.toLowerCase().trim();

        if (cleanText) {
            // A. Check exact matches
            const exactMatch = rules?.find(r => r.match_type === 'exact' && cleanText === r.pattern.toLowerCase().trim());
            if (exactMatch) {
                console.log(`[EdgeFunction] Exact keyword rule matched: "${userText}"`);
                await sendDarazMessage(store.id, data.session_id, exactMatch.reply_content, supabase, appKey, appSecret);
                return new Response(JSON.stringify({ success: true, message: 'Exact rule triggered' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // B. Check keyword sub-string matches
            const keywordMatch = rules?.find(r => r.match_type === 'keyword' && cleanText.includes(r.pattern.toLowerCase().trim()));
            if (keywordMatch) {
                console.log(`[EdgeFunction] Substring keyword rule matched: "${userText}"`);
                await sendDarazMessage(store.id, data.session_id, keywordMatch.reply_content, supabase, appKey, appSecret);
                return new Response(JSON.stringify({ success: true, message: 'Keyword rule triggered' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // C. Check Gemini AI Auto-Reply
            if (settings?.ai_enabled && geminiApiKey) {
                await handleAiAutoReply(store.id, data.session_id, userText, supabase, appKey, appSecret, geminiApiKey);
            }
        }
    }

    return new Response(JSON.stringify({ success: true, message: 'Webhook processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[EdgeFunction] Critical error handling request:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})

