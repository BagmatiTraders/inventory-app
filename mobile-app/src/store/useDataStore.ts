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
    subscribeToChanges: () => () => void;
    transactionSummaries: {
        totalPurchase: number;
        totalSales: number;
        paymentAnalysis: { type: string; sales: number; purchase: number }[];
        supplierBreakdown: { name: string; count: number; type: 'BUY' | 'SELL'; total: number }[];
    };
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

    syncPurchasingData: async () => {
        if (get().isSyncingInternal) return;

        set({ isLoading: true, isSyncingInternal: true });
        try {
            await ProductRepo.syncWithRemote();
            await SupplierRepo.syncWithRemote();
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

    updatePlanStatus: async (id, status) => {
        await PurchaseRepo.updatePlanStatus(id, status);
        await get().refreshData();
    },

    addPurchase: async (purchase: Purchase) => {
        await PurchaseRepo.upsertPurchase(purchase);
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
        await SupplierRepo.addSupplierTransaction(transaction);
        await get().refreshData();

        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
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
                            remarks: transaction.remarks,
                            created_by: user.id
                        });

                    if (!error) {
                        await SupplierRepo.upsertSupplierTransaction({ ...transaction, sync_status: 'synced' });
                    }
                }
            } catch (err) {
                console.error('Remote sync error (supplier_transactions):', err);
            }
        })();
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
            .channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, triggerSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_plans' }, triggerSync)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'store_sales' }, triggerSync)
            .subscribe();

        return () => {
            if (syncTimeout) clearTimeout(syncTimeout);
            supabase.removeChannel(channel);
        };
    },
}));
