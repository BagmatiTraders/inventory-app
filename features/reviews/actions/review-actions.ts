'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import axios from 'axios'

export interface ReviewSettings {
    store_id: string
    ai_reply_enabled: boolean
    cutoff_time: string | null
    ai_instruction: string | null
    star1_template: string
    star2_template: string
    star3_template: string
    star4_template: string
    star5_template: string
    created_at?: string
    updated_at?: string
}

const API_URL = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest'

// Helper: Sign Daraz API Requests
function signRequest(apiName: string, params: Record<string, unknown>, appSecret: string) {
    const keys = Object.keys(params).sort()
    let str = apiName
    keys.forEach(key => {
        str += key + String(params[key])
    })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

// 1. Get Store Tokens & App Config (using order app keys)
async function getStoreTokenAndSecret(storeId: string) {
    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim()
    const appSecret = process.env.DARAZ_APP_SECRET?.trim()

    if (!appKey || !appSecret) {
        throw new Error('Daraz API keys configuration missing on server env')
    }

    const supabase = await createAdminClient()
    const { data: tokenData, error } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .eq('app_type', 'order')
        .maybeSingle()

    if (error || !tokenData) {
        throw new Error(`No active order connection or token found for store: ${storeId}. Please connect your Daraz account.`)
    }

    return { appKey, appSecret, accessToken: tokenData.access_token }
}

// 2. Retrieve Review Settings
export async function getReviewSettings(storeId: string): Promise<ReviewSettings> {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('daraz_review_settings')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle()

    if (error) {
        console.error('[ReviewSettings] Error fetching settings:', error.message)
    }

    if (data) {
        return data as ReviewSettings
    }

    // Default settings
    const defaultSettings: ReviewSettings = {
        store_id: storeId,
        ai_reply_enabled: false,
        cutoff_time: null,
        ai_instruction: 'Please thank the customer for their review. Respond politely and concisely in the customer\'s language.',
        star1_template: 'We are extremely sorry for the bad experience. We will investigate and improve this.',
        star2_template: 'We apologize for the inconvenience. We are working to make it better.',
        star3_template: 'Thank you for your feedback. We will work to improve our service.',
        star4_template: 'Thank you for your rating! We hope you shop with us again.',
        star5_template: 'Thank you so much for the 5-star review! We are thrilled to serve you.'
    }

    // Insert defaults if not found
    const { data: inserted, error: insErr } = await supabase
        .from('daraz_review_settings')
        .insert(defaultSettings)
        .select()
        .single()

    if (insErr) {
        console.error('[ReviewSettings] Error creating default settings:', insErr.message)
        return defaultSettings
    }

    return inserted as ReviewSettings
}

// 3. Update Review Settings
export async function updateReviewSettings(storeId: string, settings: Partial<ReviewSettings>) {
    try {
        const supabase = await createAdminClient()
        const payload = {
            ...settings,
            updated_at: new Date().toISOString()
        }

        const { error } = await supabase
            .from('daraz_review_settings')
            .update(payload)
            .eq('store_id', storeId)

        if (error) throw error

        revalidatePath('/dashboard/chat-ai')
        return { success: true }
    } catch (err: any) {
        console.error('[ReviewSettings] Update failed:', err.message)
        return { success: false, error: err.message }
    }
}

// Helper: Call Gemini API for Review Reply
async function generateAiReviewReply(
    rating: number,
    reviewContent: string,
    storeName: string,
    settings: ReviewSettings
): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!apiKey) {
        console.warn('[ReviewAutoReply] GEMINI_API_KEY is missing in environment.')
        return null
    }

    const systemPrompt = `You are an automated AI Customer Service Assistant for our store "${storeName}" on Daraz.
We received a product review from a customer. Your job is to generate a polite, concise, and helpful reply to this review.

Review Details:
- Rating: ${rating} Star(s)
- Customer Comment: "${reviewContent}"

AI Instructions / Guidelines:
${settings.ai_instruction || 'Please thank the customer and respond appropriately.'}

Star-Specific Templates (Use this as inspiration or a baseline for your reply, but customize it to match the customer's comment if they left one):
- 1 Star Template: ${settings.star1_template}
- 2 Star Template: ${settings.star2_template}
- 3 Star Template: ${settings.star3_template}
- 4 Star Template: ${settings.star4_template}
- 5 Star Template: ${settings.star5_template}

Please generate a reply that fits the rating and comment. If the customer didn't leave a comment, you can output a slightly customized version of the star-specific template. Keep the reply short (1-2 sentences) and polite. Do not include prefixes like "Response:" or "Reply:". Just output the clean reply text.
Reply:`

    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                contents: [{
                    parts: [{ text: systemPrompt }]
                }]
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        )

        const replyText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
        return replyText ? replyText.trim() : null
    } catch (err: any) {
        console.error('[ReviewAutoReply] Gemini API call failed:', err.message)
        return null
    }
}

// 4. Post Reply to Daraz Review
export async function replyToReview(storeId: string, reviewId: string, replyContent: string) {
    try {
        const { appKey, appSecret, accessToken } = await getStoreTokenAndSecret(storeId)
        const supabase = await createAdminClient()

        const timestamp = Date.now().toString()
        const params: Record<string, unknown> = {
            app_key: appKey,
            access_token: accessToken,
            timestamp,
            sign_method: 'sha256',
            review_id: Number(reviewId),
            reply_content: replyContent
        }

        const apiPath = '/review/seller/reply/add'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log(`[ReviewReply] Submitting reply for review ${reviewId}...`)
        const response = await axios.post(`${API_URL}${apiPath}`, null, { params, timeout: 10000 })

        if (response.data.code !== "0" && response.data.code !== 0) {
            throw new Error(`Daraz API Error: ${response.data.message || response.data.msg}`)
        }

        // Update local database status
        const { error } = await supabase
            .from('daraz_reviews')
            .update({
                reply_content: replyContent,
                reply_status: 'replied',
                replied_at: new Date().toISOString()
            })
            .eq('review_id', reviewId)

        if (error) {
            console.error(`[ReviewReply] Failed to update local review ${reviewId}:`, error.message)
        }

        return { success: true }
    } catch (err: any) {
        console.error(`[ReviewReply] Reply failed for review ${reviewId}:`, err.message)
        
        // Update local database status to failed
        const supabase = await createAdminClient()
        await supabase
            .from('daraz_reviews')
            .update({
                reply_status: 'failed'
            })
            .eq('review_id', reviewId)

        return { success: false, error: err.message }
    }
}

// 5. Bulk Reply to Reviews
export async function bulkReplyToReviews(storeId: string, reviewIds: string[], replyContent: string) {
    try {
        console.log(`[ReviewBulkReply] Starting bulk reply for ${reviewIds.length} reviews...`)
        const results = []
        for (const reviewId of reviewIds) {
            const res = await replyToReview(storeId, reviewId, replyContent)
            results.push({ reviewId, ...res })
        }
        revalidatePath('/dashboard/chat-ai/reviews')
        return { success: true, results }
    } catch (err: any) {
        console.error('[ReviewBulkReply] Bulk reply process failed:', err.message)
        return { success: false, error: err.message }
    }
}

// 6. Sync Reviews from Daraz API for all active products
export async function syncDarazReviews(storeId: string) {
    try {
        const { appKey, appSecret, accessToken } = await getStoreTokenAndSecret(storeId)
        const supabase = await createAdminClient()

        // Get store details
        const { data: store, error: storeErr } = await supabase
            .from('online_stores')
            .select('*')
            .eq('id', storeId)
            .single()

        if (storeErr || !store) {
            throw new Error(`Store not found: ${storeId}`)
        }

        // Fetch active products for this store
        const { data: products, error: prodErr } = await supabase
            .from('products')
            .select('product_id, product_name, image_url')
            .or(`seller_account1.eq."${store.seller_account}",seller_account2.eq."${store.seller_account}",seller_account3.eq."${store.seller_account}",seller_account4.eq."${store.seller_account}"`)
            .eq('is_deleted', false)
            .eq('status', 'Active')

        if (prodErr) {
            throw new Error(`Failed to load store products: ${prodErr.message}`)
        }

        const activeProductIds = Array.from(new Set(
            (products || [])
                .map(p => p.product_id)
                .filter(Boolean)
                .map(id => Number(id))
        ))

        console.log(`[ReviewSync] Found ${activeProductIds.length} active products to scan for store: ${store.seller_account}`)

        // Fetch review settings
        const settings = await getReviewSettings(storeId)
        let reviewsSyncedCount = 0

        // Fetch reviews for each active product
        for (const itemId of activeProductIds) {
            try {
                const timestamp = Date.now().toString()
                const params: Record<string, unknown> = {
                    app_key: appKey,
                    access_token: accessToken,
                    timestamp,
                    sign_method: 'sha256',
                    item_id: itemId,
                    page_size: 50,
                    current: 1
                }

                const apiPath = '/review/seller/list'
                params.sign = signRequest(apiPath, params, appSecret)

                console.log(`[ReviewSync] Fetching reviews for item ${itemId}...`)
                const response = await axios.get(`${API_URL}${apiPath}`, { params, timeout: 10000 })

                if (response.data.code !== "0" && response.data.code !== 0) {
                    console.warn(`[ReviewSync] API warning for item ${itemId}: ${response.data.message || response.data.msg}`)
                    continue
                }

                const reviewList = response.data.data?.review_list || []
                
                for (const item of reviewList) {
                    const orderId = item.order_id ? String(item.order_id) : null
                    const reviews = item.reviews || []

                    // Resolve buyer name from daraz_orders
                    let buyerName = 'Buyer'
                    if (orderId) {
                        const { data: orderData } = await supabase
                            .from('daraz_orders')
                            .select('customer_name, shipping_name, customer_first_name, customer_last_name')
                            .eq('order_id', orderId)
                            .maybeSingle()
                        if (orderData) {
                            buyerName = orderData.customer_name || orderData.shipping_name || `${orderData.customer_first_name} ${orderData.customer_last_name}`.trim() || 'Buyer'
                        }
                    }

                    for (const rev of reviews) {
                        const reviewId = String(rev.id)
                        const rating = rev.ratings?.product_rating ? Number(rev.ratings.product_rating) : 5
                        const reviewContent = rev.review_content || ''
                        const replyContent = rev.seller_reply || null
                        const initialReplyStatus = replyContent ? 'replied' : 'pending'
                        const createdAt = rev.create_time ? new Date(Number(rev.create_time)).toISOString() : new Date().toISOString()

                        // Get product metadata
                        const matchedProduct = products?.find(p => Number(p.product_id) === itemId)
                        const productName = matchedProduct?.product_name || 'Product'
                        const productImage = matchedProduct?.image_url || null

                        // Check if review already exists
                        const { data: existingReview } = await supabase
                            .from('daraz_reviews')
                            .select('review_id, reply_status')
                            .eq('review_id', reviewId)
                            .maybeSingle()

                        const upsertPayload = {
                            review_id: reviewId,
                            store_id: storeId,
                            order_id: orderId,
                            item_id: String(itemId),
                            product_name: productName,
                            product_image: productImage,
                            rating,
                            review_content: reviewContent,
                            buyer_name: buyerName,
                            reply_content: replyContent,
                            reply_status: existingReview?.reply_status === 'replied' ? 'replied' : initialReplyStatus,
                            created_at: createdAt,
                            synced_at: new Date().toISOString()
                        }

                        await supabase
                            .from('daraz_reviews')
                            .upsert(upsertPayload, { onConflict: 'review_id' })

                        reviewsSyncedCount++

                        // 7. AI Auto-Reply processing (Trigger only for newly inserted/unsent reviews)
                        const isNewPending = (!existingReview && initialReplyStatus === 'pending') || (existingReview && existingReview.reply_status === 'pending' && !replyContent)
                        
                        if (isNewPending && settings.ai_reply_enabled && reviewContent.trim()) {
                            const reviewCreatedAt = new Date(createdAt)
                            const isAfterCutoff = !settings.cutoff_time || reviewCreatedAt >= new Date(settings.cutoff_time)

                            if (isAfterCutoff) {
                                console.log(`[ReviewSync] Review ${reviewId} qualifies for AI Auto-reply. Generating...`)
                                const aiReply = await generateAiReviewReply(rating, reviewContent, store.seller_account, settings)
                                if (aiReply && aiReply.trim()) {
                                    // Submit reply to Daraz API and update status
                                    const replyRes = await replyToReview(storeId, reviewId, aiReply)
                                    if (replyRes.success) {
                                        // Update auto_replied flag
                                        await supabase
                                            .from('daraz_reviews')
                                            .update({ auto_replied: true })
                                            .eq('review_id', reviewId)
                                    }
                                }
                            } else {
                                console.log(`[ReviewSync] Review ${reviewId} skipped by cutoff date filter. Created at: ${createdAt}, Cutoff: ${settings.cutoff_time}`)
                            }
                        }
                    }
                }
            } catch (itemErr: any) {
                console.error(`[ReviewSync] Error syncing reviews for item ${itemId}:`, itemErr.message)
            }
        }

        revalidatePath('/dashboard/chat-ai/reviews')
        return { success: true, count: reviewsSyncedCount }
    } catch (err: any) {
        console.error(`[ReviewSync] Review sync process failed for store ${storeId}:`, err.message)
        return { success: false, error: err.message }
    }
}
