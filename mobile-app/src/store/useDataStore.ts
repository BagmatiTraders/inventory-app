import { create } from 'zustand';
import { Product, Transaction, TransactionRepo, ProductRepo } from '../db/repo';
import { StoreSalesRepo, StoreSale } from '../db/storeSalesRepo';
import { DarazRepo, OrderStatusSummary } from '../db/darazRepo';
import { PurchaseRepo, PurchasePlan, Purchase } from '../db/purchaseRepo';
import { SupplierRepo, Supplier, SupplierTransaction } from '../db/supplierRepo';
import { StockRepo, OpeningStock, ManualAdjustment } from '../db/stockRepo';
import { CaptureRepo, MobileCapture } from '../db/captureRepo';
import { supabase } from '../lib/supabase';
import { MarketplaceRepo, MarketplaceSummary } from '../db/marketplaceRepo';
import { NotificationHelper } from '../utils/notificationHelper';
import { purgeAllTables } from '../db/database';

interface DataState {
    products: Product[];
    transactions: Transaction[];
    storeSales: StoreSale[];
    purchasePlans: PurchasePlan[];
    todayPurchases: Purchase[];
    suppliers: Supplier[];
    openingStocks: OpeningStock[];
    manualAdjustments: ManualAdjustment[];
    autoAdjustments: any[];
    captures: MobileCapture[];
    darazSummary: OrderStatusSummary | null;
    marketplaceSummary: MarketplaceSummary | null;
    isLoading: boolean;
    isSyncingInternal: boolean;
    refreshData: () => Promise<void>;
    syncPurchasingData: () => Promise<void>;
    updatePlanStatus: (id: string, status: 'Pending' | 'Complete' | 'Cancel') => Promise<void>;
    addPurchase: (purchase: Purchase) => Promise<void>;
    updatePurchase: (purchase: Purchase) => Promise<void>;
    deletePurchase: (id: string) => Promise<void>;
    addProduct: (product: any) => Promise<void>;
    addSupplier: (supplier: any) => Promise<void>;
    addSupplierTransaction: (transaction: SupplierTransaction) => Promise<void>;
    addPurchasePlan: (plan: any) => Promise<void>;
    addOpeningStock: (data: any) => Promise<void>;
    addManualAdjustment: (data: any) => Promise<void>;
    fetchAutoAdjustments: () => Promise<void>;
    addCapture: (data: any) => Promise<void>;
    addStoreSale: (data: any) => Promise<void>;
    checkNewDarazOrders: () => Promise<void>;
    handleNewDarazOrder: (orderId: string) => Promise<void>;
    subscribeToChanges: () => () => void;
    transactionSummaries: {
        totalPurchase: number;
        totalSales: number;
        paymentAnalysis: { type: string; sales: number; purchase: number }[];
        supplierBreakdown: { name: string; count: number; type: 'BUY' | 'SELL'; total: number }[];
    };
    resetAndSync: () => Promise<void>;
}

export const useDataStore = create<DataState>((set, get) => ({
    products: [],
    transactions: [],
    storeSales: [],
    darazSummary: null,
    marketplaceSummary: null,
    purchasePlans: [],
    todayPurchases: [],
    suppliers: [],
    openingStocks: [],
    manualAdjustments: [],
    autoAdjustments: [],
    captures: [],
    isLoading: false,
    isSyncingInternal: false,
    transactionSummaries: {
        totalPurchase: 0,
        totalSales: 0,
        paymentAnalysis: [],
        supplierBreakdown: []
    },

    addPurchasePlan: async (plan) => {
        // Implementation might be missing or in PurchaseRepo
        console.log('addPurchasePlan called with:', plan);
    },

    addOpeningStock: async (data) => {
        set({ isLoading: true });
        try {
            await StockRepo.addOpeningStock(data);
            await get().refreshData();
        } catch (error) {
            console.error('Error adding opening stock:', error);
            throw error;
        } finally {
            set({ isLoading: false });
        }
    },

    addManualAdjustment: async (data) => {
        set({ isLoading: true });
        try {
            await StockRepo.addManualAdjustment(data);
            await get().refreshData();
        } catch (error) {
            console.error('Error adding manual adjustment:', error);
            throw error;
        } finally {
            set({ isLoading: false });
        }
    },

    fetchAutoAdjustments: async () => {
        set({ isLoading: true });
        try {
            const autoAdjustments = await StockRepo.getAutoAdjustments();
            set({ autoAdjustments });
        } catch (error) {
            console.error('Error fetching auto adjustments:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    addCapture: async (data: any) => {
        set({ isLoading: true });
        try {
            await CaptureRepo.saveCapture(data);
            const captures = await CaptureRepo.getCaptures();
            set({ captures });
        } catch (error) {
            console.error('Error adding capture:', error);
            throw error;
        } finally {
            set({ isLoading: false });
        }
    },

    addStoreSale: async (data: any) => {
        set({ isLoading: true });
        try {
            await StoreSalesRepo.addStoreSale(data);
            await get().refreshData();
        } catch (error) {
            console.error('Error adding store sale:', error);
            throw error;
        } finally {
            set({ isLoading: false });
        }
    },

    refreshData: async () => {
        set({ isLoading: true });
        try {
            const [products, transactions, darazStatus, marketplaceSummary, suppliers, purchasePlans, openingStocks, manualAdjustments, autoAdjustments, captures, storeSales] = await Promise.all([
                ProductRepo.getAll(),
                TransactionRepo.getAll(),
                DarazRepo.getOrderStatusSummary(),
                MarketplaceRepo.getTodaySummary(),
                SupplierRepo.getAll(),
                PurchaseRepo.getPlans(),
                StockRepo.getOpeningStocks(),
                StockRepo.getManualAdjustments(),
                StockRepo.getAutoAdjustments(),
                CaptureRepo.getCaptures(),
                StoreSalesRepo.getRecentSales(20)
            ]);

            const todayPurchases = await PurchaseRepo.getTodayPurchases();

            let totalPurchase = 0;
            let totalSales = 0;
            const pmMap: Record<string, { sales: number; purchase: number }> = {};
            const sbMap: Record<string, { name: string; count: number; total: number; type: 'BUY' | 'SELL' }> = {};

            todayPurchases.forEach(p => {
                const amount = p.total_amount || 0;
                const isSell = p.purchase_type === 'Sell';
                const pType = p.payment_type || 'Cash';
                const sName = p.supplier?.supplier_name || p.purchase_name || 'Others';
                const sType: 'BUY' | 'SELL' = isSell ? 'SELL' : 'BUY';
                const sKey = `${sName}_${sType}`;

                if (isSell) totalSales += amount;
                else totalPurchase += amount;

                if (!pmMap[pType]) pmMap[pType] = { sales: 0, purchase: 0 };
                if (isSell) pmMap[pType].sales += amount;
                else pmMap[pType].purchase += amount;

                if (!sbMap[sKey]) sbMap[sKey] = { name: sName, count: 0, total: 0, type: sType };
                sbMap[sKey].count++;
                sbMap[sKey].total += amount;
            });

            const paymentAnalysis = Object.entries(pmMap).map(([type, data]) => ({ type, ...data }));
            const supplierBreakdown = Object.values(sbMap).sort((a, b) => a.name.localeCompare(b.name));

            const sortedPurchases = [...todayPurchases].sort((a, b) => {
                const nameA = a.supplier?.supplier_name || a.purchase_name || 'Others';
                const nameB = b.supplier?.supplier_name || b.purchase_name || 'Others';
                return nameA.localeCompare(nameB);
            });

            set({
                products,
                transactions,
                purchasePlans,
                todayPurchases: sortedPurchases,
                suppliers,
                darazSummary: darazStatus['all'] || null,
                openingStocks,
                manualAdjustments,
                autoAdjustments,
                captures,
                storeSales,
                marketplaceSummary,
                transactionSummaries: {
                    totalPurchase,
                    totalSales,
                    paymentAnalysis,
                    supplierBreakdown
                }
            });
        } catch (error) {
            console.error('Failed to refresh data:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    handleNewDarazOrder: async (orderId: string) => {
        try {
            console.log(`[DataStore] 📦 New Daraz Order event detected: ${orderId}`);
            const alreadyNotified = await DarazRepo.isOrderNotified(orderId);
            if (alreadyNotified) {
                console.log(`[DataStore] ℹ️ Order ${orderId} has already been notified locally. Skipping to avoid duplicates.`);
                return;
            }

            // Wait a moment for items to be synced by the webhook (they follow the order record)
            console.log(`[DataStore] ⏳ Order ${orderId}: Waiting 3s for items sync...`);
            await new Promise(resolve => setTimeout(resolve, 3000));

            const orderDetail = await DarazRepo.getOrderById(orderId);
            if (!orderDetail) {
                console.warn(`[DataStore] ⚠️ Order ${orderId} not found in DB after delay.`);
                return;
            }

            console.log(`[DataStore] 📄 Order details: status=${orderDetail.order_status}, account=${orderDetail.seller_account}`);

            // Be a bit more liberal with status for notification, but focus on Pending
            if (orderDetail.order_status !== 'Pending' && orderDetail.order_status !== 'Packed') {
                console.log(`[DataStore] ℹ️ Order ${orderId} status is ${orderDetail.order_status}. Skipping notification.`);
                return;
            }

            // Assemble product names
            let productNames = orderDetail.items_detail && orderDetail.items_detail.length > 0
                ? orderDetail.items_detail.map((item: any) => item.product_name || item.name).join(', ')
                : orderDetail.first_product_name || 'New Order';

            // Send notification
            await NotificationHelper.notifyImmediate(
                `New Order Received - ${orderDetail.seller_account}`,
                `Product: ${productNames}`
            );

            // Mark as notified
            await DarazRepo.markOrderNotified(orderId);
            console.log(`[DataStore] ✅ Notification flow complete for ${orderId}`);
        } catch (error) {
            console.error('[DataStore] ❌ Error handling new Daraz order:', error);
        }
    },

    checkNewDarazOrders: async () => {
        try {
            // Fetch only Pending orders from Supabase
            const pendingOrders = await DarazRepo.getOrders({ status: 'Pending', pageSize: 50 });

            for (const order of pendingOrders) {
                const alreadyNotified = await DarazRepo.isOrderNotified(order.id);

                if (!alreadyNotified) {
                    // Assemble product names
                    let productNames = order.first_product_name || 'Multiple Products';
                    if (order.items_detail && order.items_detail.length > 0) {
                        productNames = order.items_detail.map(item => item.name).join(', ');
                    }

                    // Send notification
                    await NotificationHelper.notifyImmediate(
                        `New Order Received - ${order.seller_account}`,
                        `Product: ${productNames}`
                    );

                    // Mark as notified
                    await DarazRepo.markOrderNotified(order.id);
                }
            }
        } catch (error) {
            console.error('Error checking new Daraz orders:', error);
        }
    },

    syncPurchasingData: async () => {
        if (get().isSyncingInternal) return;

        set({ isLoading: true, isSyncingInternal: true });
        try {
            await ProductRepo.syncWithRemote();
            await SupplierRepo.syncWithRemote();
            await SupplierRepo.syncTransactionsWithRemote();
            await PurchaseRepo.syncPlansWithRemote();
            await PurchaseRepo.syncPurchasesWithRemote();
            await StockRepo.syncFromRemote();
            await StoreSalesRepo.syncFromRemote();

            await get().refreshData();
        } catch (error) {
            console.error('Failed to sync purchasing data:', error);
        } finally {
            set({ isLoading: false, isSyncingInternal: false });
        }
    },

    resetAndSync: async () => {
        set({ isLoading: true });
        try {
            await purgeAllTables();
            // Clear local state immediately for better UX
            set({
                products: [],
                transactions: [],
                todayPurchases: [],
                purchasePlans: [],
                suppliers: [],
                marketplaceSummary: null,
                darazSummary: null
            });
            await get().syncPurchasingData();
        } catch (error) {
            console.error('Reset and sync failed:', error);
            throw error;
        } finally {
            set({ isLoading: false });
        }
    },

    updatePlanStatus: async (id, status) => {
        await PurchaseRepo.updatePlanStatus(id, status);
        await get().refreshData();
    },

    addPurchase: async (purchase: Purchase) => {
        await PurchaseRepo.upsertPurchase(purchase);
        // Auto-complete any pending plans for this product on mobile
        await PurchaseRepo.completePlanForProduct(purchase.product_id);
        await get().refreshData();

        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { error } = await supabase
                        .from('purchases')
                        .insert({
                            id: purchase.id,
                            purchase_date: purchase.purchase_date,
                            product_id: purchase.product_id,
                            supplier_id: purchase.supplier_id,
                            quantity: purchase.quantity,
                            unit_amount: purchase.unit_amount,
                            total_amount: purchase.total_amount,
                            payment_type: purchase.payment_type,
                            remarks: purchase.remarks,
                            purchase_type: purchase.purchase_type,
                            created_by: user.id,
                            updated_by: user.id
                        });

                    if (!error) {
                        await PurchaseRepo.upsertPurchase({ ...purchase, sync_status: 'synced' });
                    }
                }
            } catch (err) {
                console.error('Remote sync fail:', err);
            }
        })();
    },

    updatePurchase: async (purchase: Purchase) => {
        await PurchaseRepo.updatePurchase(purchase);
        await get().refreshData();

        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { error } = await supabase
                        .from('purchases')
                        .update({
                            purchase_date: purchase.purchase_date,
                            product_id: purchase.product_id,
                            supplier_id: purchase.supplier_id,
                            quantity: purchase.quantity,
                            unit_amount: purchase.unit_amount,
                            total_amount: purchase.total_amount,
                            payment_type: purchase.payment_type,
                            remarks: purchase.remarks,
                            purchase_type: purchase.purchase_type,
                            updated_by: user.id,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', purchase.id);

                    if (!error) {
                        await PurchaseRepo.upsertPurchase({ ...purchase, sync_status: 'synced' });
                    }
                }
            } catch (err) {
                console.error('Remote update fail:', err);
            }
        })();
    },

    deletePurchase: async (id: string) => {
        await PurchaseRepo.deletePurchase(id);
        await get().refreshData();
    },

    addProduct: async (productData: any) => {
        set({ isLoading: true });
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data: product, error: productError } = await supabase
                .from('products')
                .insert({
                    product_name: productData.product_name,
                    image_url: productData.image_url || null,
                    product_type: productData.product_type,
                    seller_sku1: productData.seller_sku1 || null,
                    seller_account1: productData.seller_account1 || null,
                    seller_sku2: productData.seller_sku2 || null,
                    seller_account2: productData.seller_account2 || null,
                    seller_sku3: productData.seller_sku3 || null,
                    seller_account3: productData.seller_account3 || null,
                    seller_sku4: productData.seller_sku4 || null,
                    seller_account4: productData.seller_account4 || null,
                    created_by: user.id,
                    updated_by: user.id,
                    status: 'Active'
                })
                .select()
                .single();

            if (productError) throw productError;

            if (productData.product_type === 'combo' && productData.combo_items) {
                const comboInserts = productData.combo_items.map((item: any) => ({
                    parent_product_id: product.id,
                    child_product_id: item.child_product_id,
                    quantity: item.quantity
                }));

                const { error: comboError } = await supabase
                    .from('product_combos')
                    .insert(comboInserts);

                if (comboError) {
                    await supabase.from('products').delete().eq('id', product.id);
                    throw comboError;
                }
            }

            await ProductRepo.upsert({
                id: product.id,
                name: product.product_name,
                sku: product.seller_sku1 || '',
                price: Number(product.est_price) || 0,
                stock: 0,
                image_url: product.image_url || undefined,
                product_type: product.product_type,
                product_id: product.product_id,
                updated_at: product.updated_at
            });

            await get().refreshData();
        } catch (error) {
            console.error('Failed to add product:', error);
            throw error;
        } finally {
            set({ isLoading: false });
        }
    },

    addSupplier: async (supplierData: any) => {
        set({ isLoading: true });
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data: supplier, error } = await supabase
                .from('suppliers')
                .insert({
                    supplier_name: supplierData.supplier_name,
                    contact_details: supplierData.contact_details || null,
                    remarks: supplierData.remarks || null,
                    created_by: user.id
                })
                .select()
                .single();

            if (error) throw error;

            await SupplierRepo.upsert({
                id: supplier.id,
                supplier_name: supplier.supplier_name,
                contact_details: supplier.contact_details,
                remarks: supplier.remarks,
                is_deleted: supplier.is_deleted,
                updated_at: supplier.updated_at
            });

            await get().refreshData();
        } catch (error) {
            console.error('Failed to add supplier:', error);
            throw error;
        } finally {
            set({ isLoading: false });
        }
    },

    addSupplierTransaction: async (transaction: SupplierTransaction) => {
        // Save to local database first
        await SupplierRepo.addSupplierTransaction(transaction);

        // Sync to remote database synchronously
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('User not authenticated');
            }

            const { error } = await supabase
                .from('supplier_transactions')
                .insert({
                    id: transaction.id,
                    transaction_date: transaction.transaction_date,
                    supplier_id: transaction.supplier_id,
                    transaction_mode: transaction.transaction_mode,
                    transaction_type: transaction.transaction_type,
                    amount: transaction.amount,
                    payment_method: transaction.payment_method,
                    cheque_date: transaction.cheque_date,
                    remarks: transaction.remarks
                });

            if (error) {
                console.error('Failed to sync to remote:', error);
                throw new Error(`Failed to sync transaction: ${error.message}`);
            }

            // Update local record to mark as synced
            await SupplierRepo.upsertSupplierTransaction({ ...transaction, sync_status: 'synced' });
        } catch (err) {
            console.error('Remote sync error (supplier_transactions):', err);
            throw err; // Re-throw to let caller handle the error
        }

        // Refresh data after successful sync
        await get().refreshData();
    },

    subscribeToChanges: () => {
        let syncTimeout: NodeJS.Timeout | null = null;
        const triggerSync = () => {
            if (syncTimeout) clearTimeout(syncTimeout);
            syncTimeout = setTimeout(() => {
                get().syncPurchasingData();
            }, 1000);
        };

        const channel = supabase
            .channel('daraz-notifications')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, triggerSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_plans' }, triggerSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'store_sales' }, triggerSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, triggerSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_transactions' }, triggerSync)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'daraz_orders' }, (payload: any) => {
                console.log('[DataStore] ⚡ Realtime INSERT: daraz_orders', payload.new?.id, payload.new?.order_status);
                if (payload.new?.order_status === 'Pending' || payload.new?.order_status === 'Packed') {
                    get().handleNewDarazOrder(payload.new.id);
                }
                triggerSync();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'daraz_orders' }, (payload: any) => {
                console.log('[DataStore] ⚡ Realtime UPDATE: daraz_orders', payload.new?.id, payload.new?.order_status);
                // Also trigger notification on UPDATE in case status was set after INSERT
                if (payload.new?.order_status === 'Pending' || payload.new?.order_status === 'Packed') {
                    get().handleNewDarazOrder(payload.new.id);
                }
                triggerSync();
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'daraz_orders' }, triggerSync)
            .subscribe((status, err) => {
                console.log('[DataStore] 📡 Realtime subscription status:', status);
                if (err) console.error('[DataStore] ❌ Realtime subscription error:', err);

                if (status === 'CHANNEL_ERROR') {
                    console.log('[DataStore] 🔄 Attempting to re-subscribe due to channel error...');
                    setTimeout(() => get().subscribeToChanges(), 5000);
                }
            });

        return () => {
            if (syncTimeout) clearTimeout(syncTimeout);
            supabase.removeChannel(channel);
        };
    },
}));
