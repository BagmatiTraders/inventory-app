import { NextResponse } from 'next/server'
import { pushPriceToDaraz } from '@/features/sales/actions/avg-price-actions'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { productId, storeIds } = body

        if (!productId) {
            return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 })
        }

        const result = await pushPriceToDaraz(productId, storeIds)
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('API Error pushing price to Daraz:', error)
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Failed to push price to Daraz' 
        }, { status: 500 })
    }
}
