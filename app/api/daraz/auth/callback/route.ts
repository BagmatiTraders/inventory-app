
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import axios from 'axios'

// Helper to sign requests (similar to server.js)
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
    const code = searchParams.get('code')
    const storeId = searchParams.get('state') // We passed storeId as state

    if (!code) {
        return NextResponse.json({ error: 'Authorization code is missing' }, { status: 400 })
    }

    if (!storeId) {
        return NextResponse.json({ error: 'Store ID (state) is missing' }, { status: 400 })
    }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
    const appSecret = process.env.DARAZ_APP_SECRET
    const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest'

    if (!appKey || !appSecret) {
        return NextResponse.json({ error: 'Daraz API configuration missing' }, { status: 500 })
    }

    try {
        // Exchange code for token
        const timestamp = new Date().getTime()
        const params: Record<string, any> = {
            code: code,
            app_key: appKey,
            sign_method: 'sha256',
            timestamp: timestamp
        }

        const apiPath = '/auth/token/create'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log('Requesting Daraz token...', { url: `${apiUrl}${apiPath}`, params })

        const response = await axios.post(`${apiUrl}${apiPath}`, null, { params })
        const data = response.data

        if (data.access_token) {
            // Save to Supabase
            const supabase = await createClient()

            // Upsert token
            const { error } = await supabase
                .from('daraz_api_tokens')
                .upsert({
                    store_id: storeId,
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    expires_in: data.expires_in,
                    token_type: data.token_type,
                    account: data.account,
                    country: data.country,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'store_id' })

            if (error) {
                console.error('Database Error:', error)
                return NextResponse.json({ error: 'Failed to save token' }, { status: 500 })
            }

            // Redirect back to Order Sync page with success
            // Use NEXT_PUBLIC_APP_URL to ensure we redirect to the correct public URL (likely ngrok or production)
            // and avoid issues where request.url might resolve to https://localhost (which fails)
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
            return NextResponse.redirect(`${baseUrl}/dashboard/sales/daraz/order-sync?status=success`)
        } else {
            console.error('Daraz Auth Failed:', data)
            return NextResponse.json({ error: 'Failed to obtain access token', details: data }, { status: 500 })
        }

    } catch (error: any) {
        console.error('Auth Callback Error:', error.response?.data || error.message)
        return NextResponse.json({
            error: 'Authentication process failed',
            details: error.response?.data?.message || error.message
        }, { status: 500 })
    }
}
