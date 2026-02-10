import { getDb } from './database';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { decode } from 'base64-arraybuffer';

export interface MobileCapture {
    id: string;
    image_path: string;
    image_url: string;
    price?: number;
    remarks?: string;
    group_id?: string;
    created_at: string;
    updated_at: string;
    sync_status?: 'pending' | 'synced';
}

export const CaptureRepo = {
    getCaptures: async () => {
        const db = await getDb();
        const rows = await db.getAllAsync<any>(`
            SELECT * FROM mobile_captures 
            ORDER BY created_at DESC
        `);
        return rows as MobileCapture[];
    },

    saveCapture: async (data: {
        base64Image: string,
        price?: number,
        remarks?: string,
        group_id?: string
    }) => {
        const db = await getDb();
        const id = uuidv4();
        const now = new Date().toISOString();
        const fileName = `${id}.jpg`;
        const filePath = `uploads/${fileName}`;

        // 1. Upload to Supabase Storage
        try {
            const { error: uploadError } = await supabase.storage
                .from('mobile-captures')
                .upload(filePath, decode(data.base64Image), {
                    contentType: 'image/jpeg'
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('mobile-captures')
                .getPublicUrl(filePath);

            // 2. Save to local SQLite
            await db.runAsync(
                `INSERT INTO mobile_captures (id, image_path, image_url, price, remarks, group_id, created_at, updated_at, sync_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, filePath, publicUrl, data.price || null, data.remarks || '', data.group_id || null, now, now, 'pending']
            );

            // 3. Sync metadata to Supabase table
            const { error: tableError } = await supabase
                .from('mobile_captures')
                .insert({
                    id,
                    image_path: filePath,
                    image_url: publicUrl,
                    price: data.price || null,
                    remarks: data.remarks || '',
                    group_id: data.group_id || null,
                    user_id: (await supabase.auth.getUser()).data.user?.id
                });

            if (!tableError) {
                await db.runAsync('UPDATE mobile_captures SET sync_status = ? WHERE id = ?', ['synced', id]);
            }

            return id;
        } catch (error) {
            console.error('Error in saveCapture:', error);
            throw error;
        }
    },

    syncFromRemote: async () => {
        const db = await getDb();
        const { data: remoteData, error } = await supabase
            .from('mobile_captures')
            .select('*');

        if (!error && remoteData) {
            for (const item of remoteData) {
                await db.runAsync(
                    `INSERT OR REPLACE INTO mobile_captures (id, image_path, image_url, price, remarks, group_id, created_at, updated_at, sync_status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [item.id, item.image_path, item.image_url, item.price, item.remarks, item.group_id, item.created_at, item.updated_at, 'synced']
                );
            }
        }
    }
};
