import crypto from 'crypto'
import axios from 'axios'
import { createClient } from '@/lib/supabase/server'

// Helper to sign extraction requests
function signRequest(apiName: string, params: Record<string, any>, appSecret: string) {
    const keys = Object.keys(params).sort()
    let str = apiName
    keys.forEach(key => {
        str += key + params[key]
    })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

export async function fetchDarazFinanceTransactions(orderId: string, storeId: string, orderDate?: string) {
    const supabase = await createClient()

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
    const appSecret = process.env.DARAZ_APP_SECRET
    const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

    if (!appKey || !appSecret) {
        throw new Error('Daraz API configuration missing')
    }

    // 1. Get Token
    const { data: tokenData, error: dbError } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .single()

    if (dbError || !tokenData) {
        throw new Error('No active connection/token found for this store.')
    }

    const timestamp = new Date().getTime()
    let startTime = new Date()
    if (orderDate) {
        startTime = new Date(orderDate)
    } else {
        startTime.setDate(startTime.getDate() - 60) // Look back 60 days by default
    }

    // Safety buffer for start time (sometimes transaction is exactly on order date)
    // Actually, order date is fine.

    const endTime = new Date() // Now

    // Ensure range is within API limits if needed, but Daraz usually allows querying specific order ID regardless of time? 
    // "The start_time and end_time range should be less than 150 days."
    const diffTime = Math.abs(endTime.getTime() - startTime.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 150) {
        // adjust start time to be no more than 150 days from now?
        // But what if order was 200 days ago? We might miss it.
        // For now, let's clamp start to 140 days ago if diff is huge, assuming transactions settle within 5 months.
        startTime = new Date()
        startTime.setDate(startTime.getDate() - 140)
    }

    const params: Record<string, any> = {
        app_key: appKey,
        access_token: tokenData.access_token,
        timestamp: timestamp,
        sign_method: 'sha256',
        trade_order_id: orderId,
        start_time: startTime.toISOString().split('T')[0],
        end_time: endTime.toISOString().split('T')[0],
        trans_type: -1
    }

    const apiPath = '/finance/transaction/details/get'
    params.sign = signRequest(apiPath, params, appSecret)

    try {
        const response = await axios.get(`${apiUrl}${apiPath}`, { params })

        if ((response.data.code !== "0" && response.data.code !== 0) || !response.data.data) {
            // If error code is about data not found, return empty
            return []
        }

        return response.data.data || []
    } catch (error: any) {
        console.error('Finance API Fetch Error:', error.response?.data || error.message)
        throw new Error('Failed to fetch finance from Daraz API')
    }
}
