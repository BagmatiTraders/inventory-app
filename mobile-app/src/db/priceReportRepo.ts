import { supabase } from '../lib/supabase';

export interface InventoryPriceReportItem {
    product_id: string;
    product_code?: number;
    product_name: string;
    product_type?: 'combo' | 'single';
    image_url: string | null;
    est_price: number | null;
    last_price: number | null;
    low_price: number | null;
    high_price: number | null;
    average_price: number | null;
    seller_sku1?: string | null;
    seller_sku2?: string | null;
    seller_sku3?: string | null;
    seller_sku4?: string | null;
    product_combos?: Array<{ count: number }> | null;
}

export interface GetPriceReportsParams {
    from: number;
    to: number;
    search?: string;
}

export const PriceReportRepo = {
    async getInventoryPriceReports(params: GetPriceReportsParams) {
        const { from, to, search } = params;

        let query = supabase
            .from('inventory_price_reports_view')
            .select('*', { count: 'exact' });

        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            query = query.or(`product_name.ilike.${searchTerm},seller_sku1.ilike.${searchTerm},seller_sku2.ilike.${searchTerm},seller_sku3.ilike.${searchTerm},seller_sku4.ilike.${searchTerm}`);
        }

        query = query
            .order('product_name', { ascending: true })
            .range(from, to);

        const { data, count, error } = await query;

        if (error) {
            console.error('Error fetching price reports:', error);
            throw new Error('Failed to fetch price reports');
        }

        // --- Data Enrichment (Matching Web Implementation) ---
        const productIds = (data || []).map((item: any) => item.product_id);
        let enrichedData = (data || []) as InventoryPriceReportItem[];

        if (productIds.length > 0) {
            // Fetch product types
            const { data: productsData } = await supabase
                .from('products')
                .select('id, product_type')
                .in('id', productIds);

            // Fetch combo counts
            const { data: combosData } = await supabase
                .from('product_combos')
                .select('parent_product_id, child_product_id')
                .in('parent_product_id', productIds);

            const productTypesMap: Record<string, string> = {};
            productsData?.forEach((p: any) => {
                productTypesMap[p.id] = p.product_type;
            });

            const comboCountsMap: Record<string, number> = {};
            combosData?.forEach((c: any) => {
                comboCountsMap[c.parent_product_id] = (comboCountsMap[c.parent_product_id] || 0) + 1;
            });

            enrichedData = enrichedData.map(item => ({
                ...item,
                product_type: (productTypesMap[item.product_id] || 'single') as any,
                product_combos: comboCountsMap[item.product_id]
                    ? [{ count: comboCountsMap[item.product_id] }]
                    : null
            }));
        }

        return {
            data: enrichedData,
            totalCount: count || 0
        };
    },

    async updateProductEstPrice(productId: string, estPrice: number) {
        const { error } = await supabase
            .from('products')
            .update({ est_price: estPrice })
            .eq('id', productId);

        if (error) {
            console.error('Error updating est price:', error);
            throw new Error('Failed to update estimated price');
        }

        return { success: true };
    }
};
