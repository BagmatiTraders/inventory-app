'use client';

import { App } from '@capacitor/app';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

const CapacitorAppListener = () => {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        let backButtonListener: any;

        const setupListener = async () => {
            backButtonListener = await App.addListener('backButton', async (event) => {
                // Define routes where the app should exit
                const exitRoutes = ['/', '/login', '/dashboard'];

                // Also check if we are in nested routes that shouldn't exit?
                // For now, simple exact match or maybe logic. 
                // If the user is deep in /dashboard/sales/..., we want to go back.

                if (exitRoutes.includes(pathname)) {
                    await App.exitApp();
                } else {
                    // Navigate back
                    router.back();
                }
            });
        };

        setupListener();

        return () => {
            if (backButtonListener) {
                backButtonListener.remove();
            }
        };
    }, [pathname, router]);

    return null;
};

export default CapacitorAppListener;
