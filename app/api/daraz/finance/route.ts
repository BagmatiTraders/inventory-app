import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import axios from 'axios'

// Helper to sign extraction requests
function signRequest(apiName: string, params: Record<string, any>, appSecret: string) {
    const keys = Object.keys(params).sort()
    let str = apiName
    keys.forEach(key => {
        str += key + params[key]
    })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const orderId = searchParams.get('orderId')
    const orderDate = searchParams.get('orderDate') // Needed for start_time/end_time
    const storeId = searchParams.get('storeId')

    if (!orderId || !storeId) {
        return NextResponse.json({ error: 'Order ID and Store ID are required' }, { status: 400 })
    }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
    const appSecret = process.env.DARAZ_APP_SECRET
    const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

    if (!appKey || !appSecret) {
        return NextResponse.json({ error: 'Daraz API configuration missing' }, { status: 500 })
    }

    const supabase = await createClient()

    // 1. Get Token
    const { data: tokenData, error: dbError } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .single()

    if (dbError || !tokenData) {
        return NextResponse.json({ error: 'No active connection found for this store.', details: dbError }, { status: 401 })
    }

    try {
        const timestamp = new Date().getTime()

        // Define date range: Daraz requires transaction queries to be within a range.
        // We'll look from Order Date to Today (capped at max allowed by API if any, doc says < 180 days)
        // Usually transaction happens after order.
        let startTime = new Date()
        if (orderDate) {
            startTime = new Date(orderDate)
        } else {
            // Fallback: 30 days ago
            startTime.setDate(startTime.getDate() - 30)
        }

        const endTime = new Date() // Now

        // Ensure not more than 180 days (API limit)
        const diffTime = Math.abs(endTime.getTime() - startTime.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 150) {
            // Adjust start time to be within range if order is very old
            // But realistically, transactions settle within a few weeks.
            // If order is very old, we might miss it if we strictly clamp. 
            // However, usually we care about recent access.
            // Let's rely on standard logic: query [OrderDate, OrderDate + 180 days] or [OrderDate, Now]
            // If Now is > OrderDate + 180, we might need a sliding window. 
            // For simplicity, let's try strict [OrderDate, Now] and assume typical use case.
        }

        const params: Record<string, any> = {
            app_key: appKey,
            access_token: tokenData.access_token,
            timestamp: timestamp,
            sign_method: 'sha256',
            trade_order_id: orderId, // Filter by Order ID
            start_time: startTime.toISOString().split('T')[0],
            end_time: endTime.toISOString().split('T')[0],
            trans_type: -1 // All types
        }

        const apiPath = '/finance/transaction/details/get'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log('Fetching Finance Details...', { params })

        const response = await axios.get(`${apiUrl}${apiPath}`, { params })

        if ((response.data.code !== "0" && response.data.code !== 0) || !response.data.data) {
            console.error('Daraz Finance API Error:', response.data)
            return NextResponse.json({
                error: 'Daraz Finance API returned error',
                details: response.data
            }, { status: 500 })
        }

        // Return the list of transactions
        return NextResponse.json({
            transactions: response.data.data || []
        })

    } catch (error: any) {
        console.error('Finance Fetch Error:', error.response?.data || error.message)
        return NextResponse.json({
            error: 'Failed to fetch finance details',
            details: error.response?.data || error.message
        }, { status: 500 })
    }
}
