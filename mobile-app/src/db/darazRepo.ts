import { supabase } from '../lib/supabase';
import { API_CONFIG } from '../config/api';
import { getDb } from './database';

export interface DarazOrder {
    id: string;
    order_number: string;
    tracking_number: string;
    customer_name: string;
    order_date: string;
    order_status: string;
    grand_total: number;
    item_count: number;
    total_quantity: number;
    first_product_name: string;
    seller_account: string;
    daraz_created_at: string;
    items_detail?: any[];
}

export interface DarazStore {
    id: string;
    seller_account: string;
    company_name: string;
}

export interface DailySalesData {
    date: string;
    seller_account: string;
    shipped_qty: number;
    shipped_amount: number;
    delivered_qty: number;
    delivered_amount: number;
    returning_to_seller_qty: number;
    returned_delivered_qty: number;
    return_qty: number;
    customer_return_delivered_qty: number;
}

export interface AccountSummary {
    seller_account: string;
    company_name?: string;
    pending: number;
    packed: number;
    ready_to_ship: number;
    shipped: number;
    delivered: number;
    returning_to_seller: number;
    returned_delivered: number;
    customer_return: number;
    customer_return_delivered: number;
}

export interface OrderStatusSummary {
    pending: number;
    packed: number;
    readyToShip: number;
    shipped: number;
}

export interface FiscalYear {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
}

export interface SalesReport {
    fiscalYear: string;
    totalOrders: number;
    totalQuantity: number;
    totalAmount: number;
    activeSellerAccounts: number;
}

export const DarazRepo = {
    async getStores(): Promise<DarazStore[]> {
        const { data, error } = await supabase
            .from('online_stores')
            .select('id, seller_account, company_name')
            .order('company_name');

        if (error) {
            console.error('Error fetching stores:', error);
            return [];
        }
        return data as DarazStore[];
    },

    async getOrders(options: {
        status?: string;
        todayOnly?: boolean;
        sellerAccounts?: string[];
        searchQuery?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        pageSize?: number;
    }): Promise<DarazOrder[]> {
        const { status, todayOnly = false, sellerAccounts, searchQuery, startDate, endDate, page = 0, pageSize = 20 } = options;

        let query = supabase
            .from('daraz_orders')
            .select(`
                *,
                online_stores!inner(seller_account)
            `)
            .or('deleted.is.null,deleted.eq.false');

        const today = new Date().toISOString().split('T')[0];
        const todayStartISO = `${today}T00:00:00.000Z`;

        if (todayOnly) {
            const rts = "Ready to Ship";
            query = query.or(`order_status.eq.Pending,order_status.eq.Packed,order_status.eq."${rts}",order_date.eq.${today},and(order_status.eq.Shipped,shipped_at.gte.${todayStartISO})`);
        }

        if (status && status !== 'All') {
            const dbStatus = status === 'RTS' ? 'Ready to Ship' : status;
            query = query.eq('order_status', dbStatus);

            if (todayOnly && status === 'Shipped') {
                query = query.gte('shipped_at', todayStartISO);
            }
        }

        if (sellerAccounts && sellerAccounts.length > 0) {
            query = query.filter('online_stores.seller_account', 'in', `(${sellerAccounts.map(a => `"${a}"`).join(',')})`);
        }

        if (searchQuery && searchQuery.trim()) {
            const term = searchQuery.trim();
            query = query.or(`order_number.ilike.%${term}%,tracking_number.ilike.%${term}%,first_product_name.ilike.%${term}%`);
        }

        if (startDate) query = query.gte('order_date', startDate);
        if (endDate) query = query.lte('order_date', endDate);

        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await query
            .order('daraz_created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('Error fetching Daraz orders:', error);
            return [];
        }

        const formattedData = (data as any[]).map(order => ({
            ...order,
            seller_account: order.online_stores?.seller_account || 'Unknown'
        }));

        const orderIds = formattedData.map(o => o.id);
        if (orderIds.length > 0) {
            const { data: itemsData, error: itemsError } = await supabase
                .from('daraz_order_items')
                .select('*')
                .in('order_id', orderIds)
                .order('item_sequence', { ascending: true });

            if (!itemsError && itemsData) {
                return formattedData.map(order => ({
                    ...order,
                    items_detail: itemsData
                        .filter(item => item.order_id === order.id)
                        .map(item => ({
                            name: item.product_name,
                            product_name: item.product_name,
                            product_id: item.product_id, // UUID
                            quantity: item.quantity,
                            item_price: item.amount,
                            paid_price: item.total_amount,
                            seller_sku: item.seller_sku
                        }))
                })) as DarazOrder[];
            }
        }

        return formattedData as DarazOrder[];
    },

    async getOrderById(id: string): Promise<DarazOrder | null> {
        const { data, error } = await supabase
            .from('daraz_orders')
            .select(`
                *,
                online_stores!inner(seller_account)
            `)
            .eq('id', id)
            .maybeSingle();

        if (error || !data) return null;

        const order = {
            ...data,
            seller_account: data.online_stores?.seller_account || 'Unknown'
        };

        const { data: itemsData } = await supabase
            .from('daraz_order_items')
            .select('*')
            .eq('order_id', id)
            .order('item_sequence', { ascending: true });

        if (itemsData) {
            order.items_detail = itemsData.map(item => ({
                name: item.product_name,
                product_name: item.product_name,
                product_id: item.product_id, // UUID
                quantity: item.quantity,
                item_price: item.amount,
                seller_sku: item.seller_sku
            }));
        }

        return order as DarazOrder;
    },

    async getDailySalesReport(): Promise<DailySalesData[]> {
        try {
            let allOrders: any[] = [];
            let page = 0;
            const pageSize = 1000;

            while (true) {
                const from = page * pageSize;
                const to = from + pageSize - 1;

                const { data: orders, error } = await supabase
                    .from('daraz_orders')
                    .select(`
                        id,
                        order_status,
                        price,
                        updated_at,
                        shipped_at,
                        delivered_at,
                        online_stores!inner(seller_account)
                    `)
                    .eq('deleted', false)
                    .in('order_status', ['Shipped', 'Delivered', 'Returning to Seller', 'Returned Delivered', 'Customer Return', 'Customer Return Delivered'])
                    .range(from, to);

                if (error) throw error;
                if (!orders || orders.length === 0) break;

                allOrders = allOrders.concat(orders);
                if (orders.length < pageSize) break;
                page++;
            }

            const reportMap = new Map<string, Map<string, any>>();

            const getStats = (dateStr: string, sellerAccount: string) => {
                if (!reportMap.has(dateStr)) {
                    reportMap.set(dateStr, new Map());
                }
                const dateMap = reportMap.get(dateStr)!;
                if (!dateMap.has(sellerAccount)) {
                    dateMap.set(sellerAccount, {
                        shipped_qty: 0,
                        shipped_amount: 0,
                        delivered_qty: 0,
                        delivered_amount: 0,
                        returning_to_seller_qty: 0,
                        returned_delivered_qty: 0,
                        return_qty: 0,
                        customer_return_delivered_qty: 0
                    });
                }
                return dateMap.get(sellerAccount)!;
            };

            allOrders.forEach((order: any) => {
                const sellerAccount = order.online_stores?.seller_account || 'Unknown';
                const price = parseFloat(order.price) || 0;

                if (order.shipped_at) {
                    const date = order.shipped_at.split('T')[0];
                    const stats = getStats(date, sellerAccount);
                    stats.shipped_qty++;
                    stats.shipped_amount += price;
                } else if (order.order_status === 'Shipped') {
                    const date = order.updated_at.split('T')[0];
                    const stats = getStats(date, sellerAccount);
                    stats.shipped_qty++;
                    stats.shipped_amount += price;
                }

                if (order.delivered_at) {
                    const date = order.delivered_at.split('T')[0];
                    const stats = getStats(date, sellerAccount);
                    stats.delivered_qty++;
                    stats.delivered_amount += price;
                }

                const updateDate = order.updated_at.split('T')[0];
                const stats = getStats(updateDate, sellerAccount);

                switch (order.order_status) {
                    case 'Delivered':
                        if (!order.delivered_at) {
                            stats.delivered_qty++;
                            stats.delivered_amount += price;
                        }
                        break;
                    case 'Returning to Seller':
                        stats.returning_to_seller_qty++;
                        break;
                    case 'Returned Delivered':
                        stats.returned_delivered_qty++;
                        break;
                    case 'Customer Return':
                        stats.return_qty++;
                        break;
                    case 'Customer Return Delivered':
                        stats.customer_return_delivered_qty++;
                        break;
                }
            });

            const result: DailySalesData[] = [];
            const sortedDates = Array.from(reportMap.keys()).sort((a, b) => b.localeCompare(a));

            sortedDates.forEach(date => {
                const dateMap = reportMap.get(date)!;
                dateMap.forEach((stats, seller_account) => {
                    result.push({ date, seller_account, ...stats });
                });
            });

            return result;
        } catch (error) {
            console.error('Error in getDailySalesReport:', error);
            return [];
        }
    },

    async getAccountSummary(): Promise<AccountSummary[]> {
        try {
            const { data: stores, error: storeError } = await supabase
                .from('online_stores')
                .select('seller_account, company_name')
                .order('seller_account');

            if (storeError) throw storeError;

            const summaryMap = new Map<string, AccountSummary>();
            stores?.forEach(store => {
                if (store.seller_account) {
                    summaryMap.set(store.seller_account, {
                        seller_account: store.seller_account,
                        company_name: store.company_name,
                        pending: 0,
                        packed: 0,
                        ready_to_ship: 0,
                        shipped: 0,
                        delivered: 0,
                        returning_to_seller: 0,
                        returned_delivered: 0,
                        customer_return: 0,
                        customer_return_delivered: 0
                    });
                }
            });

            let page = 0;
            const pageSize = 1000;

            while (true) {
                const from = page * pageSize;
                const to = from + pageSize - 1;

                const { data: orders, error } = await supabase
                    .from('daraz_orders')
                    .select(`
                        order_status,
                        online_stores!inner(seller_account)
                    `)
                    .or('deleted.is.null,deleted.eq.false')
                    .range(from, to);

                if (error) throw error;
                if (!orders || orders.length === 0) break;

                orders.forEach((order: any) => {
                    const sellerAccount = order.online_stores?.seller_account || 'Unknown';
                    const mainStatus = order.order_status;

                    if (!summaryMap.has(sellerAccount)) {
                        summaryMap.set(sellerAccount, {
                            seller_account: sellerAccount,
                            pending: 0,
                            packed: 0,
                            ready_to_ship: 0,
                            shipped: 0,
                            delivered: 0,
                            returning_to_seller: 0,
                            returned_delivered: 0,
                            customer_return: 0,
                            customer_return_delivered: 0
                        });
                    }

                    const stats = summaryMap.get(sellerAccount)!;

                    if (mainStatus === 'Customer Return Delivered') stats.customer_return_delivered++;
                    else if (mainStatus === 'Customer Return') stats.customer_return++;
                    else if (mainStatus === 'Returned Delivered') stats.returned_delivered++;
                    else if (mainStatus === 'Returning to Seller') stats.returning_to_seller++;
                    else if (mainStatus === 'Delivered') stats.delivered++;
                    else if (mainStatus === 'Shipped') stats.shipped++;
                    else if (mainStatus === 'Ready to Ship') stats.ready_to_ship++;
                    else if (mainStatus === 'Packed') stats.packed++;
                    else if (mainStatus === 'Pending') stats.pending++;
                });

                if (orders.length < pageSize) break;
                page++;
            }

            return Array.from(summaryMap.values());
        } catch (error) {
            console.error('Error fetching account summary:', error);
            return [];
        }
    },

    async getOrderStatusSummary(): Promise<Record<string, OrderStatusSummary>> {
        try {
            const today = new Date().toISOString().split('T')[0];
            const todayStart = `${today}T00:00:00.000Z`;

            const { data: orders, error } = await supabase
                .from('daraz_orders')
                .select(`
                    order_status, 
                    updated_at,
                    shipped_at,
                    online_stores!inner(seller_account)
                `)
                .or('deleted.is.null,deleted.eq.false')
                .in('order_status', ['Pending', 'Packed', 'Ready to Ship', 'Shipped']);

            if (error) throw error;

            const summary: Record<string, OrderStatusSummary> = {
                'all': { pending: 0, packed: 0, readyToShip: 0, shipped: 0 }
            };

            orders?.forEach((order: any) => {
                const status = order.order_status;
                const account = order.online_stores?.seller_account || 'Unknown';

                if (!summary[account]) {
                    summary[account] = { pending: 0, packed: 0, readyToShip: 0, shipped: 0 };
                }

                if (status === 'Pending') { summary[account].pending++; summary['all'].pending++; }
                else if (status === 'Packed') { summary[account].packed++; summary['all'].packed++; }
                else if (status === 'Ready to Ship') { summary[account].readyToShip++; summary['all'].readyToShip++; }
                else if (status === 'Shipped') {
                    const shippedAt = order.shipped_at || order.updated_at;
                    if (shippedAt && shippedAt >= todayStart) {
                        summary[account].shipped++; summary['all'].shipped++;
                    }
                }
            });

            return summary;
        } catch (error) {
            console.error('Error fetching status summary:', error);
            return { 'all': { pending: 0, packed: 0, readyToShip: 0, shipped: 0 } };
        }
    },

    async getFiscalYears(): Promise<FiscalYear[]> {
        const { data, error } = await supabase
            .from('fiscal_years')
            .select('*')
            .order('start_date', { ascending: false });
        if (error) {
            console.error('Error fetching fiscal years:', error);
            return [];
        }
        return data as FiscalYear[];
    },

    async getSalesByFiscalYear(fiscalYearId: string): Promise<SalesReport> {
        try {
            const { data: fiscalYear, error: fyError } = await supabase
                .from('fiscal_years')
                .select('*')
                .eq('id', fiscalYearId)
                .single();

            if (fyError || !fiscalYear) throw fyError || new Error('Fiscal year not found');

            let totalOrders = 0;
            let totalAmount = 0;
            let totalQuantity = 0;
            const sellerAccounts = new Set<string>();

            let page = 0;
            const pageSize = 1000;

            while (true) {
                const { data, error } = await supabase
                    .from('daraz_orders')
                    .select(`
                        id,
                        order_status,
                        online_stores!inner(seller_account),
                        items:daraz_order_items(
                            quantity,
                            amount
                        )
                    `)
                    .gte('order_date', fiscalYear.start_date)
                    .lte('order_date', fiscalYear.end_date)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error || !data || data.length === 0) break;

                totalOrders += data.length;
                data.forEach((order: any) => {
                    const orderQty = order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
                    const orderAmt = order.items?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.amount || 0)), 0) || 0;

                    totalQuantity += orderQty;
                    totalAmount += orderAmt;

                    if (order.online_stores?.seller_account) sellerAccounts.add(order.online_stores.seller_account);
                });

                if (data.length < pageSize) break;
                page++;
            }

            return {
                fiscalYear: fiscalYear.name,
                totalOrders,
                totalQuantity,
                totalAmount,
                activeSellerAccounts: sellerAccounts.size
            };

        } catch (error) {
            console.error('Error fetching sales by fiscal year:', error);
            return {
                fiscalYear: 'Error',
                totalOrders: 0,
                totalQuantity: 0,
                totalAmount: 0,
                activeSellerAccounts: 0
            };
        }
    },

    async getMonthlySalesByFiscalYear(fiscalYearId: string) {
        try {
            const { data: fiscalYear } = await supabase.from('fiscal_years').select('*').eq('id', fiscalYearId).single();
            if (!fiscalYear) return [];

            const monthlyData: Record<string, { count: number, total: number }> = {};
            let page = 0;
            const pageSize = 1000;
            while (true) {
                const { data, error } = await supabase
                    .from('daraz_orders')
                    .select(`order_date, items:daraz_order_items(quantity, amount)`)
                    .gte('order_date', fiscalYear.start_date)
                    .lte('order_date', fiscalYear.end_date)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error || !data || data.length === 0) break;

                data.forEach((order: any) => {
                    const month = order.order_date.substring(0, 7); // YYYY-MM
                    if (!monthlyData[month]) monthlyData[month] = { count: 0, total: 0 };
                    monthlyData[month].count++;
                    const orderTotal = order.items?.reduce((sum: number, i: any) => sum + ((i.quantity || 0) * (i.amount || 0)), 0) || 0;
                    monthlyData[month].total += orderTotal;
                });
                if (data.length < pageSize) break;
                page++;
            }

            return Object.entries(monthlyData).map(([month, d]) => ({
                month, orderCount: d.count, totalAmount: d.total
            })).sort((a, b) => a.month.localeCompare(b.month));
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    async getSalesBySellerAccount(fiscalYearId: string) {
        try {
            const { data: fiscalYear } = await supabase.from('fiscal_years').select('*').eq('id', fiscalYearId).single();
            if (!fiscalYear) return [];

            const accountData: Record<string, { orders: number, quantity: number, totalAmount: number }> = {};
            let page = 0;
            const pageSize = 1000;

            while (true) {
                const { data, error } = await supabase
                    .from('daraz_orders')
                    .select(`
                        online_stores!inner(seller_account),
                        items:daraz_order_items(quantity, amount)
                    `)
                    .gte('order_date', fiscalYear.start_date)
                    .lte('order_date', fiscalYear.end_date)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error || !data || data.length === 0) break;

                data.forEach((order: any) => {
                    const acc = order.online_stores?.seller_account || 'Unknown';
                    if (!accountData[acc]) accountData[acc] = { orders: 0, quantity: 0, totalAmount: 0 };
                    accountData[acc].orders++;

                    const orderQty = order.items?.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0) || 0;
                    const orderTotal = order.items?.reduce((sum: number, i: any) => sum + ((i.quantity || 0) * (i.amount || 0)), 0) || 0;

                    accountData[acc].quantity += orderQty;
                    accountData[acc].totalAmount += orderTotal;
                });
                if (data.length < pageSize) break;
                page++;
            }

            const { data: stores } = await supabase.from('online_stores').select('seller_account, company_name');
            const storeMap = new Map(stores?.map(s => [s.seller_account, s.company_name]) || []);

            return Object.entries(accountData).map(([acc, d]) => ({
                sellerAccount: acc,
                companyName: storeMap.get(acc) || acc,
                orders: d.orders,
                quantity: d.quantity,
                totalAmount: d.totalAmount
            }));

        } catch (e) {
            console.error(e);
            return [];
        }
    },

    async getDailyOrderTrends(days: number = 7) {
        try {
            const today = new Date();
            const startDate = new Date();
            startDate.setDate(today.getDate() - days + 1);
            const startDateStr = startDate.toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('daraz_orders')
                .select('daraz_created_at, order_status')
                .gte('daraz_created_at', startDateStr)
                .neq('order_status', 'Cancelled')
                .order('daraz_created_at', { ascending: true });

            if (error) throw error;

            const trendMap = new Map<string, number>();

            for (let i = 0; i < days; i++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + i);
                trendMap.set(d.toISOString().split('T')[0], 0);
            }

            data?.forEach((order: any) => {
                const date = new Date(order.daraz_created_at).toISOString().split('T')[0];
                if (trendMap.has(date)) {
                    trendMap.set(date, (trendMap.get(date) || 0) + 1);
                }
            });

            return Array.from(trendMap.entries()).map(([date, count]) => ({
                date,
                count
            }));

        } catch (error) {
            console.error('Error fetching daily trends:', error);
            return [];
        }
    },

    async getProfitTrackerOrders(params: {
        page?: number;
        limit?: number;
        search?: string;
        syncStatus?: 'all' | 'synced' | 'not_synced';
        sellerAccount?: string;
    }) {
        const { page = 1, limit = 50, search, syncStatus = 'all', sellerAccount } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('daraz_order_report_view')
            .select('*', { count: 'exact' });

        if (search && search.trim()) {
            query = query.or(`order_number.ilike.%${search.trim()}%,invoice_number.ilike.%${search.trim()}%`);
        }

        if (sellerAccount && sellerAccount !== 'All' && sellerAccount !== 'All Accounts') {
            query = query.eq('seller_account', sellerAccount);
        }

        if (syncStatus === 'synced') {
            query = query.gt('daraz_fees', 0).gt('total_purchase_cost', 0);
        } else if (syncStatus === 'not_synced') {
            query = query.or('daraz_fees.is.null,daraz_fees.lte.0,total_purchase_cost.lte.0');
        }

        const { data, count, error } = await query
            .order('delivered_by_daraz', { ascending: false, nullsFirst: false })
            .order('delivered_at', { ascending: false, nullsFirst: false })
            .range(from, to);

        if (error) throw error;

        const formattedData = (data || []).map((order: any) => ({
            ...order,
            products: order.items_summary || [],
            sync_status: (order.total_purchase_cost > 0 && order.daraz_fees > 0) ? 'synced' : 'not_synced'
        }));

        return {
            data: formattedData,
            totalCount: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
        };
    },

    async getProfitTrackerDailyStats(params: {
        search?: string;
        syncStatus?: string;
    }) {
        const { data, error } = await supabase.rpc('get_cached_daily_profit_summary', {
            search_term: params.search || '',
            sync_status_param: params.syncStatus || 'all',
            start_date_param: null,
            end_date_param: null
        });

        if (error) throw error;
        return data as any[];
    },

    async getProfitTrackerCompleteDateStats(params: {
        search?: string;
        syncStatus?: string;
        sellerAccount?: string;
    }) {
        let query = supabase
            .from('daraz_order_report_view')
            .select('*');

        if (params.search && params.search.trim()) {
            query = query.or(`order_number.ilike.%${params.search.trim()}%,invoice_number.ilike.%${params.search.trim()}%`);
        }

        if (params.sellerAccount && params.sellerAccount !== 'All' && params.sellerAccount !== 'All Accounts') {
            query = query.eq('seller_account', params.sellerAccount);
        }

        if (params.syncStatus === 'synced') {
            query = query.gt('daraz_fees', 0).gt('total_purchase_cost', 0);
        } else if (params.syncStatus === 'not_synced') {
            query = query.or('daraz_fees.is.null,daraz_fees.lte.0,total_purchase_cost.lte.0');
        }

        const { data, error } = await query
            .order('delivered_by_daraz', { ascending: false, nullsFirst: false })
            .order('delivered_at', { ascending: false, nullsFirst: false })
            .limit(10000);
        if (error) throw error;

        const dateStats: Record<string, any> = {};

        (data || []).forEach((order: any) => {
            const dateRaw = order.delivered_by_daraz || order.delivered_at;
            if (!dateRaw) return;

            const dateKey = dateRaw.split('T')[0];
            if (!dateStats[dateKey]) {
                dateStats[dateKey] = { statsBySeller: {}, totalProfit: 0, totalRevenue: 0 };
            }

            const seller = order.seller_account || 'Unknown';
            if (!dateStats[dateKey].statsBySeller[seller]) {
                dateStats[dateKey].statsBySeller[seller] = { profit: 0, missing: 0, revenue: 0, cost: 0 };
            }


            const orderProfit = parseFloat(order.estimated_profit) || 0;
            const orderRevenue = parseFloat(order.total_revenue) || 0;
            const orderCost = parseFloat(order.total_purchase_cost) || 0;
            const isMissing = !orderCost || orderCost <= 0;

            dateStats[dateKey].totalProfit += orderProfit;
            dateStats[dateKey].totalRevenue += orderRevenue;
            dateStats[dateKey].statsBySeller[seller].profit += orderProfit;
            dateStats[dateKey].statsBySeller[seller].revenue += orderRevenue;
            dateStats[dateKey].statsBySeller[seller].cost += orderCost;
            if (isMissing) {
                dateStats[dateKey].statsBySeller[seller].missing += 1;
            }
        });

        return dateStats;
    },

    async syncOrderProfit(orderNumber: string) {
        try {
            const url = `${API_CONFIG.BASE_URL}/api/daraz/profit/sync`;
            console.log(`Syncing order profit for ${orderNumber} via ${url}...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ orderNumber })
            });

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (e) {
                console.error('Non-JSON response received:', text);
                throw new Error(`Server returned non-JSON response. Check if the URL is correct: ${url}`);
            }

            if (!response.ok) throw new Error(result.error || 'Failed to sync profit');
            return result;
        } catch (error: any) {
            console.error('Error syncing order profit:', error);
            throw error;
        }
    },

    async getOrderStock(identifiers: string[]): Promise<Record<string, number>> {
        try {
            const db = await getDb();
            if (identifiers.length === 0) return {};

            const placeholders = identifiers.map(() => '?').join(',');
            // Try to match by ID (UUID) first, then by name as fallback
            const rows = await db.getAllAsync<{ id: string, name: string, stock: number }>(
                `SELECT id, name, stock FROM products WHERE id IN (${placeholders}) OR name IN (${placeholders})`,
                [...identifiers, ...identifiers]
            );

            const stockMap: Record<string, number> = {};
            // First pass: names for fallback
            rows.forEach(row => {
                stockMap[row.name] = row.stock;
            });
            // Second pass: IDs for precision (overwrites if matching)
            rows.forEach(row => {
                stockMap[row.id] = row.stock;
            });

            return stockMap;
        } catch (error) {
            console.error('Error fetching order stock:', error);
            return {};
        }
    },

    async getLiveOrderStock(identifiers: string[]): Promise<Record<string, number>> {
        try {
            if (identifiers.length === 0) return {};

            // Split identifiers into valid UUIDs and others (names)
            const uuids = identifiers.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
            const names = identifiers.filter(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

            let query = supabase.from('inventory_price_reports_view').select('product_id, product_name, current_stock');

            const conditions: string[] = [];
            if (uuids.length > 0) {
                conditions.push(`product_id.in.(${uuids.join(',')})`);
            }
            if (names.length > 0) {
                // Ensure names are properly quoted for the filter
                conditions.push(`product_name.in.(${names.map(n => `"${n.replace(/"/g, '\\"')}"`).join(',')})`);
            }

            if (conditions.length > 0) {
                query = query.or(conditions.join(','));
            } else {
                return {};
            }

            const { data, error } = await query;

            if (error) throw error;

            const stockMap: Record<string, number> = {};
            data?.forEach(row => {
                // Map by both name and ID for robust matching
                stockMap[row.product_name] = row.current_stock;
                stockMap[row.product_id] = row.current_stock;
            });

            return stockMap;
        } catch (error) {
            console.error('Error fetching live order stock:', error);
            // Fallback to local stock if live fetch fails
            return this.getOrderStock(identifiers);
        }
    },

    async isOrderNotified(orderId: string): Promise<boolean> {
        try {
            const db = await getDb();
            const result = await db.getFirstAsync<{ id: string }>('SELECT id FROM notified_orders WHERE id = ?', [orderId]);
            return !!result;
        } catch (e) {
            return false;
        }
    },

    async getProductGlobalDemand(productId: string, productName: string): Promise<number> {
        try {
            // Build OR condition safely
            let orCondition = `product_name.eq."${productName}"`;
            if (productId && productId.length > 10) {
                orCondition = `product_id.eq.${productId},` + orCondition;
            }

            // Using daraz_orders!inner to filter by order status
            const { data: filteredData, error: filteredError } = await supabase
                .from('daraz_order_items')
                .select(`
                    quantity,
                    daraz_orders!inner (
                        order_status
                    )
                `)
                .or(orCondition)
                .in('daraz_orders.order_status', ['Pending', 'Packed', 'Ready to Ship', 'pending', 'packed', 'ready_to_ship']);

            if (filteredError) throw filteredError;

            const total = (filteredData || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
            return total;

        } catch (error) {
            console.error('Error fetching global demand:', error);
            return 0;
        }
    },

    async markOrderNotified(orderId: string) {
        try {
            const db = await getDb();
            await db.runAsync('INSERT OR IGNORE INTO notified_orders (id) VALUES (?)', [orderId]);
        } catch (e) {
            console.error('Failed to mark order as notified:', e);
        }
    }
};
