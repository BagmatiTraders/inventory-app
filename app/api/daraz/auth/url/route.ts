
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const storeId = searchParams.get('storeId')

    if (!storeId) {
        return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY
    const redirectUri = process.env.DARAZ_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/daraz/auth/callback`

    if (!appKey) {
        return NextResponse.json({ error: 'Daraz App Key is not configured' }, { status: 500 })
    }

    // State parameter passes the storeId to the callback so we know which store to link the token to
    const state = storeId

    // Construct the OAuth URL
    // Standard Daraz OAuth URL: https://api.daraz.com.np/oauth/authorize
    const authUrl = `https://api.daraz.com.np/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${appKey}&state=${state}`

    return NextResponse.json({ url: authUrl })
}
