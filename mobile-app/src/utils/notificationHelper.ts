// import * as Notifications from 'expo-notifications';
// import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';

// Notifications functionality disabled due to Expo Go SDK 53 restrictions on remote notifications.
// Use development build to restore.

/*
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});
*/

export const NotificationHelper = {
    async notifyImmediate(title: string, body: string) {
        console.log(`[NotificationHelper] (Disabled) would notify:`, { title, body });
    },

    async requestPermissions() {
        console.log('[NotificationHelper] (Disabled) requestPermissions called');
        return false; // Pretend not granted
    },

    async scheduleReminder(id: string, title: string, body: string, date: Date) {
        console.log('[NotificationHelper] (Disabled) scheduleReminder called', { id, title });
        return null;
    },

    async cancelReminder(id: string) {
        console.log('[NotificationHelper] (Disabled) cancelReminder called', { id });
    }
};
