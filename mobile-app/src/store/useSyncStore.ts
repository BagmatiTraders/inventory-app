import { create } from 'zustand';
import * as Network from 'expo-network';

interface SyncState {
    isOnline: boolean;
    isSyncing: boolean;
    lastSyncTime: string | null;
    setOnline: (status: boolean) => void;
    setSyncing: (status: boolean) => void;
    setLastSyncTime: (time: string) => void;
    checkConnection: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set) => ({
    isOnline: true,
    isSyncing: false,
    lastSyncTime: null,
    setOnline: (status) => set({ isOnline: status }),
    setSyncing: (status) => set({ isSyncing: status }),
    setLastSyncTime: (time) => set({ lastSyncTime: time }),
    checkConnection: async () => {
        const networkState = await Network.getNetworkStateAsync();
        set({ isOnline: !!networkState.isConnected && !!networkState.isInternetReachable });
    },
}));
