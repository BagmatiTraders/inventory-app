import { supabase } from '../lib/supabase';
import { getDb } from './database';

export interface Reminder {
    id: string;
    date: string;
    type: 'General' | 'Important';
    reminder: string;
    reminder_datetime?: string | null;
    status: 'Open' | 'Close';
    created_by: string;
    created_at: string;
    sync_status?: 'pending' | 'synced';
    creator?: { full_name: string };
}

export const ReminderRepo = {
    async getAll(userId?: string, role?: string, statusFilter?: 'Open' | 'Close'): Promise<Reminder[]> {
        const db = await getDb();
        let query = 'SELECT * FROM reminders';
        const params: any[] = [];
        const conditions: string[] = [];

        // Role-based filtering
        if (role !== 'admin' && userId) {
            conditions.push('created_by = ?');
            params.push(userId);
        }

        // Status filter
        if (statusFilter) {
            conditions.push('status = ?');
            params.push(statusFilter);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // Sort: Open first, then Important type, then by date descending
        query += ' ORDER BY status DESC, type DESC, date DESC';

        const reminders = await db.getAllAsync<Reminder>(query, params);
        return reminders;
    },

    async create(reminder: Reminder) {
        const db = await getDb();
        await db.runAsync(
            `INSERT INTO reminders (
                id, date, type, reminder, reminder_datetime, status,
                created_by, created_at, sync_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                reminder.id,
                reminder.date,
                reminder.type,
                reminder.reminder,
                reminder.reminder_datetime || null,
                reminder.status,
                reminder.created_by,
                reminder.created_at,
                'pending'
            ]
        );
    },

    async update(reminder: Reminder) {
        const db = await getDb();
        await db.runAsync(
            `UPDATE reminders SET
                date = ?,
                type = ?,
                reminder = ?,
                reminder_datetime = ?,
                status = ?,
                sync_status = ?
            WHERE id = ?`,
            [
                reminder.date,
                reminder.type,
                reminder.reminder,
                reminder.reminder_datetime || null,
                reminder.status,
                'pending',
                reminder.id
            ]
        );
    },

    async updateStatus(id: string, status: 'Open' | 'Close') {
        const db = await getDb();
        await db.runAsync(
            'UPDATE reminders SET status = ?, sync_status = ? WHERE id = ?',
            [status, 'pending', id]
        );
    },

    async delete(id: string) {
        const db = await getDb();
        await db.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
    },

    async syncWithRemote(userId?: string, role?: string) {
        try {
            console.log('Syncing reminders from remote...');
            let query = supabase
                .from('reminders')
                .select('*');

            // Role-based filtering
            if (role !== 'admin' && userId) {
                query = query.eq('created_by', userId);
            }

            const { data, error } = await query
                .order('status', { ascending: false })
                .order('type', { ascending: false })
                .order('date', { ascending: false });

            if (error) throw error;

            if (data) {
                const db = await getDb();
                await db.withTransactionAsync(async () => {
                    // Clear existing data
                    await db.runAsync('DELETE FROM reminders');

                    // Insert synced data
                    for (const rem of data) {
                        await db.runAsync(
                            `INSERT INTO reminders (
                                id, date, type, reminder, reminder_datetime, status,
                                created_by, created_at, sync_status
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                rem.id,
                                rem.date,
                                rem.type,
                                rem.reminder,
                                rem.reminder_datetime || null,
                                rem.status,
                                rem.created_by,
                                rem.created_at,
                                'synced'
                            ]
                        );
                    }
                });
                console.log(`Successfully synced ${data.length} reminders.`);
            }
        } catch (error) {
            console.error('Failed to sync reminders:', error);
        }
    },

    async syncPendingToRemote(userId: string) {
        try {
            console.log(`[ReminderRepo] Starting sync for user: ${userId}`);
            const db = await getDb();
            const pending = await db.getAllAsync<Reminder>(
                'SELECT * FROM reminders WHERE sync_status = ?',
                ['pending']
            );

            if (pending.length === 0) {
                console.log('[ReminderRepo] No pending reminders found to sync.');
                return;
            }

            console.log(`[ReminderRepo] Syncing ${pending.length} pending reminders to remote...`);

            for (const reminder of pending) {
                console.log(`[ReminderRepo] Attempting to upsert reminder: ${reminder.id}`);
                const { data, error } = await supabase
                    .from('reminders')
                    .upsert({
                        id: reminder.id,
                        date: reminder.date,
                        type: reminder.type,
                        reminder: reminder.reminder,
                        reminder_datetime: reminder.reminder_datetime,
                        status: reminder.status,
                        created_by: reminder.created_by,
                        created_at: reminder.created_at
                    });

                if (error) {
                    console.error(`[ReminderRepo] Supabase upsert error for ${reminder.id}:`, error);
                    throw error;
                }

                console.log(`[ReminderRepo] Successfully upserted ${reminder.id}. Updating local status...`);
                // Mark as synced
                await db.runAsync(
                    'UPDATE reminders SET sync_status = ? WHERE id = ?',
                    ['synced', reminder.id]
                );
            }

            console.log('[ReminderRepo] Successfully synced all pending reminders.');
        } catch (error) {
            console.error('[ReminderRepo] Failed to sync pending reminders:', error);
            throw error; // Re-throw to catch in UI if needed
        }
    }
};
