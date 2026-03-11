import { getDb } from './database';
import { supabase } from '../lib/supabase';

export interface PanVatBill {
    id: string;
    issue_bill_date_ad: string;
    issue_bill_date_bs: string;
    supplier_company_id: string | null;
    supplier_company_name: string | null;
    supplier_pan_vat: string | null;
    invoice_no: string;
    buyer_company_id: string | null;
    buyer_company_name: string | null;
    buyer_pan_vat: string | null;
    sub_total_amount: number;
    taxable_amount: number;
    vat_13_percent: number;
    total_amount: number;
    fiscal_year_id: string | null;
    created_at: string;
    updated_at: string | null;
    is_deleted: boolean;
    sync_status: 'synced' | 'pending';
}

export interface PanVatBillItem {
    id: string;
    bill_id: string;
    hs_code: string | null;
    particulars: string;
    quantity: number;
    rate: number;
    amount: number;
    line_order: number;
}

export interface PurchaseBillingReportItem {
    supplier_company_id: string | null;
    supplier_company_name: string;
    buyer_company_id: string | null;
    buyer_company_name: string;
    total_bill_amount: number;
    bill_count: number;
}

export const PanVatRepo = {
    async getAll(): Promise<PanVatBill[]> {
        const db = await getDb();
        return await db.getAllAsync<PanVatBill>(
            'SELECT * FROM pan_vat_bills WHERE is_deleted = 0 ORDER BY issue_bill_date_ad DESC'
        );
    },

    async getSummary(): Promise<{ totalBill: number; totalAmount: number }> {
        const db = await getDb();
        const result = await db.getFirstAsync<{ totalBill: number; totalAmount: number }>(
            'SELECT COUNT(*) as totalBill, IFNULL(SUM(total_amount), 0) as totalAmount FROM pan_vat_bills WHERE is_deleted = 0'
        );
        return result || { totalBill: 0, totalAmount: 0 };
    },

    async getReport(): Promise<PurchaseBillingReportItem[]> {
        const db = await getDb();
        // Mimic the web grouping logic
        const query = `
            SELECT 
                supplier_company_id, 
                IFNULL(supplier_company_name, 'Unknown Supplier') as supplier_company_name, 
                buyer_company_id, 
                IFNULL(buyer_company_name, 'Unknown Buyer') as buyer_company_name, 
                IFNULL(SUM(total_amount), 0) as total_bill_amount,
                COUNT(*) as bill_count
            FROM pan_vat_bills 
            WHERE is_deleted = 0
            GROUP BY supplier_company_id, buyer_company_id
            ORDER BY total_bill_amount DESC
        `;
        return await db.getAllAsync<PurchaseBillingReportItem>(query);
    },

    async upsert(bill: PanVatBill) {
        const db = await getDb();
        await db.runAsync(
            `INSERT OR REPLACE INTO pan_vat_bills (
                id, issue_bill_date_ad, issue_bill_date_bs, supplier_company_id, 
                supplier_company_name, supplier_pan_vat, invoice_no, buyer_company_id, 
                buyer_company_name, buyer_pan_vat, sub_total_amount, taxable_amount, 
                vat_13_percent, total_amount, fiscal_year_id, created_at, updated_at, 
                is_deleted, sync_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                bill.id, bill.issue_bill_date_ad, bill.issue_bill_date_bs, bill.supplier_company_id,
                bill.supplier_company_name, bill.supplier_pan_vat, bill.invoice_no, bill.buyer_company_id,
                bill.buyer_company_name, bill.buyer_pan_vat, bill.sub_total_amount, bill.taxable_amount,
                bill.vat_13_percent, bill.total_amount, bill.fiscal_year_id, bill.created_at, bill.updated_at,
                bill.is_deleted ? 1 : 0, bill.sync_status
            ]
        );
    },

    async syncWithRemote() {
        try {
            console.log('[PanVatRepo] Syncing PAN/VAT bills...');
            const { data, error } = await supabase
                .from('pan_vat_bills')
                .select('*')
                .eq('is_deleted', false)
                .order('issue_bill_date_ad', { ascending: false });

            if (error) throw error;

            if (data) {
                const db = await getDb();
                await db.withTransactionAsync(async () => {
                    for (const b of data) {
                        await this.upsert({
                            ...b,
                            is_deleted: b.is_deleted || false,
                            sync_status: 'synced'
                        });
                    }
                });
                console.log(`[PanVatRepo] Synced ${data.length} bills.`);
            }
        } catch (error) {
            console.error('[PanVatRepo] Sync failed:', error);
        }
    }
};
