import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DEFAULT_PROMPT = `You are an expert e-commerce product listing optimizer for Daraz Nepal.

Given the following product details, generate a complete product listing in a SINGLE JSON response:

PRODUCT: {productName}
PRICE: NPR {price}
STORE ACCOUNTS: {storeNames}
CATEGORY PATH: {categoryPath}
CATEGORY ATTRIBUTES SCHEMA: {attributesSchema}
IMAGE AVAILABLE: {hasImage}

INSTRUCTIONS:
1. TITLES: Generate one unique SEO-optimized title for EACH store account name listed in "STORE ACCOUNTS". Each title must be different — use different keyword arrangements, keyword-rich descriptors, and angles. Max 255 characters each. Key format: exact store account name as the JSON key.
2. CATEGORY: Suggest the best matching Daraz Nepal category path (e.g. "Watches Sunglasses Jewellery > Jewellery > Men > Fashion Jewellery > Bracelets").
3. DESCRIPTION: Start with "<p><strong>Perfect for:</strong>" followed by 3 lines on a new line each describing the ideal buyer or use case. Then write approximately 200 words of compelling product description using HTML <p> and <ul><li> tags. End with a mention of fast delivery and cash on delivery across Nepal.
4. HIGHLIGHTS: Write exactly 8 to 10 specific bullet points as complete sentences. Cover: product material/quality, key design features, dimensions/weight if relevant, use cases, compatibility, care instructions, and value proposition. Make each point unique and informative.
5. ATTRIBUTES: Fill values for ALL provided category attributes. Rules: (a) "brand" attribute MUST always be "No Brand", (b) for singleSelect attributes, choose the most appropriate option from the provided options array, (c) for text attributes, infer a concise appropriate value from the product context.

Return ONLY a valid JSON object — no markdown, no extra text:
{
  "titles": { "StoreName1": "Unique SEO title for store 1", "StoreName2": "Different SEO title for store 2" },
  "category_suggestion": "Parent > Sub Category > Leaf Category",
  "description": "<p><strong>Perfect for:</strong><br/>Line 1<br/>Line 2<br/>Line 3</p><p>Full description here...</p>",
  "highlights": ["Highlight sentence 1.", "Highlight sentence 2.", "..."],
  "attributes": { "brand": "No Brand", "other_attr": "value" }
}`

export async function GET() {
    try {
        const supabase = await createAdminClient()

        // Load AI model/key settings
        const { data: aiRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'daraz_ai_settings')
            .maybeSingle()

        // Load prompt template
        const { data: promptRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'daraz_listing_prompt')
            .maybeSingle()

        return NextResponse.json({
            model: aiRow?.value?.model || 'gpt-4o-mini',
            apiKey: aiRow?.value?.apiKey || '',
            listingPrompt: promptRow?.value?.prompt || DEFAULT_PROMPT
        })
    } catch (error: any) {
        return NextResponse.json({
            model: 'gpt-4o-mini',
            apiKey: '',
            listingPrompt: DEFAULT_PROMPT
        })
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createAdminClient()
        const body = await request.json()

        // Save model + API key
        if (body.model !== undefined || body.apiKey !== undefined) {
            const { error: aiError } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'daraz_ai_settings',
                    value: {
                        model: body.model || 'gpt-4o-mini',
                        apiKey: body.apiKey || ''
                    },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' })

            if (aiError) throw aiError
        }

        // Save prompt template if provided
        if (body.listingPrompt !== undefined) {
            const { error: promptError } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'daraz_listing_prompt',
                    value: { prompt: body.listingPrompt },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' })

            if (promptError) throw promptError
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('[SaveAiSettings] Error saving settings:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
