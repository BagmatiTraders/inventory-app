import { supabase } from '../lib/supabase';
import { getDb } from './database';

export interface Expense {
    id: string;
    date: string;
    category: string;
    expense_item: string;
    amount: number;
    remarks?: string;
    created_by: string;
    created_at: string;
    updated_by?: string;
    updated_at?: string;
    edit_count: number;
    last_edited_at?: string;
    sync_status?: 'pending' | 'synced';
    creator?: { full_name: string };
}

export const ExpenseCategories = {
    VEHICLE: 'Vehicle Expenses',
    OFFICE: 'Office Expenses',
    RENT: 'Rent',
    PERSONAL: 'Personal Expenses',
    OTHERS: 'Others'
} as const;

export const VehicleItems = ['Fuel', 'Servicing', 'Spare Parts', 'Load', 'Others'];
export const OfficeItems = ['Stationary', 'Software Subscription', 'Miscellenous', 'Others'];

export const ExpenseRepo = {
    async getAll(userId?: string, role?: string): Promise<Expense[]> {
        const db = await getDb();
        let query = 'SELECT * FROM expenses';
        const params: any[] = [];

        // Role-based filtering
        if (role !== 'admin' && userId) {
            query += ' WHERE created_by = ?';
            params.push(userId);
        }

        query += ' ORDER BY date DESC, created_at DESC';

        const expenses = await db.getAllAsync<Expense>(query, params);
        return expenses;
    },

    async getDateWiseReport(userId?: string, role?: string): Promise<{ date: string; count: number; total: number }[]> {
        const db = await getDb();
        let query = `
            SELECT 
                date,
                COUNT(*) as count,
                SUM(amount) as total
            FROM expenses
        `;
        const params: any[] = [];

        if (role !== 'admin' && userId) {
            query += ' WHERE created_by = ?';
            params.push(userId);
        }

        query += ' GROUP BY date ORDER BY date DESC';

        return await db.getAllAsync<any>(query, params);
    },

    async create(expense: Expense) {
        const db = await getDb();
        await db.runAsync(
            `INSERT INTO expenses (
                id, date, category, expense_item, amount, remarks,
                created_by, created_at, edit_count, sync_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                expense.id,
                expense.date,
                expense.category,
                expense.expense_item,
                expense.amount,
                expense.remarks || null,
                expense.created_by,
                expense.created_at,
                0,
                'pending'
            ]
        );
    },

    async update(expense: Expense) {
        const db = await getDb();
        await db.runAsync(
            `UPDATE expenses SET
                date = ?,
                category = ?,
                expense_item = ?,
                amount = ?,
                remarks = ?,
                updated_by = ?,
                updated_at = ?,
                edit_count = edit_count + 1,
                last_edited_at = ?,
                sync_status = ?
            WHERE id = ?`,
            [
                expense.date,
                expense.category,
                expense.expense_item,
                expense.amount,
                expense.remarks || null,
                expense.updated_by,
                expense.updated_at,
                expense.updated_at,
                'pending',
                expense.id
            ]
        );
    },

    async delete(id: string) {
        const db = await getDb();
        await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
    },

    canEdit(expense: Expense): { canEdit: boolean; reason?: string } {
        if (expense.edit_count >= 1) {
            return { canEdit: false, reason: 'Already edited once' };
        }

        const createdAt = new Date(expense.created_at);
        const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

        if (hoursSinceCreation >= 24) {
            return { canEdit: false, reason: '24-hour window passed' };
        }

        return { canEdit: true };
    },

    async syncWithRemote(userId?: string, role?: string) {
        try {
            console.log('Syncing expenses from remote...');
            let query = supabase
                .from('expenses')
                .select('*');

            // Role-based filtering
            if (role !== 'admin' && userId) {
                query = query.eq('created_by', userId);
            }

            const { data, error } = await query.order('date', { ascending: false });

            if (error) throw error;

            if (data) {
                const db = await getDb();
                await db.withTransactionAsync(async () => {
                    // Clear existing data
                    await db.runAsync('DELETE FROM expenses');

                    // Insert synced data
                    for (const exp of data) {
                        await db.runAsync(
                            `INSERT INTO expenses (
                                id, date, category, expense_item, amount, remarks,
                                created_by, created_at, updated_by, updated_at,
                                edit_count, last_edited_at, sync_status
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                exp.id,
                                exp.date,
                                exp.category,
                                exp.expense_item,
                                exp.amount,
                                exp.remarks || null,
                                exp.created_by,
                                exp.created_at,
                                exp.updated_by || null,
                                exp.updated_at || null,
                                exp.edit_count || 0,
                                exp.last_edited_at || null,
                                'synced'
                            ]
                        );
                    }
                });
                console.log(`Successfully synced ${data.length} expenses.`);
            }
        } catch (error) {
            console.error('Failed to sync expenses:', error);
        }
    },

    async syncPendingToRemote(userId: string) {
        try {
            console.log(`[ExpenseRepo] Starting sync for user: ${userId}`);
            const db = await getDb();
            const pending = await db.getAllAsync<Expense>(
                'SELECT * FROM expenses WHERE sync_status = ?',
                ['pending']
            );

            if (pending.length === 0) {
                console.log('[ExpenseRepo] No pending expenses found to sync.');
                return;
            }

            console.log(`[ExpenseRepo] Syncing ${pending.length} pending expenses to remote...`);

            for (const expense of pending) {
                console.log(`[ExpenseRepo] Attempting to upsert expense: ${expense.id}`);
                const { data, error } = await supabase
                    .from('expenses')
                    .upsert({
                        id: expense.id,
                        date: expense.date,
                        category: expense.category,
                        expense_item: expense.expense_item,
                        amount: expense.amount,
                        remarks: expense.remarks,
                        created_by: expense.created_by,
                        created_at: expense.created_at,
                        updated_by: expense.updated_by,
                        updated_at: expense.updated_at,
                        edit_count: expense.edit_count,
                        last_edited_at: expense.last_edited_at
                    });

                if (error) {
                    console.error(`[ExpenseRepo] Supabase upsert error for ${expense.id}:`, error);
                    throw error;
                }

                console.log(`[ExpenseRepo] Successfully upserted ${expense.id}. Updating local status...`);
                // Mark as synced
                await db.runAsync(
                    'UPDATE expenses SET sync_status = ? WHERE id = ?',
                    ['synced', expense.id]
                );
            }

            console.log('[ExpenseRepo] Successfully synced all pending expenses.');
        } catch (error) {
            console.error('[ExpenseRepo] Failed to sync pending expenses:', error);
            throw error; // Re-throw to catch in UI if needed
        }
    }
};
