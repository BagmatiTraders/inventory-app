import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Validation middleware
async function validateApiKey(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false
    }
    const apiKey = authHeader.split(' ')[1]
    return apiKey === process.env.MESSENGER_APP_API_KEY
}

export async function GET(req: NextRequest) {
    if (!await validateApiKey(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const supabase = await createAdminClient()

        // Fetch products (Active only)
        // We return simplified structure
        const { data: products, error } = await supabase
            .from('products')
            .select('id, product_name, image_url, est_price, product_type, product_id')
            .eq('is_deleted', false)
            .eq('status', 'Active')
            .order('product_name', { ascending: true })
            .limit(100) // Limit to 100 for now to avoid overload

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(products)

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
