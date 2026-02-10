import { supabase } from '../lib/supabase';

export interface MarketplaceSummary {
    totalAmount: number;
    delivered: number;
    pending: number;
    shipped: number;
}

export const MarketplaceRepo = {
    async getTodaySummary(): Promise<MarketplaceSummary> {
        try {
            const today = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('marketplace_orders')
                .select('total_amount, order_status')
                .eq('order_date', today);

            if (error) throw error;

            const summary: MarketplaceSummary = {
                totalAmount: 0,
                delivered: 0,
                pending: 0,
                shipped: 0
            };

            data?.forEach(order => {
                summary.totalAmount += Number(order.total_amount) || 0;

                const status = order.order_status;
                if (status === 'Delivered') summary.delivered++;
                else if (status === 'Pending') summary.pending++;
                else if (status === 'Shipped') summary.shipped++;
            });

            return summary;
        } catch (error) {
            console.error('Error fetching marketplace summary:', error);
            return { totalAmount: 0, delivered: 0, pending: 0, shipped: 0 };
        }
    }
};
