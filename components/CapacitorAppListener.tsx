'use client';

import { App } from '@capacitor/app';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const CapacitorAppListener = () => {
    const router = useRouter();
    const pathname = usePathname();
    const pathnameRef = useRef(pathname);

    // Keep ref updated with latest pathname
    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname]);

    useEffect(() => {
        let backButtonListener: any;

        const setupListener = async () => {
            backButtonListener = await App.addListener('backButton', async () => {
                const currentPath = pathnameRef.current;
                // Define routes where the app should exit
                const exitRoutes = ['/', '/login', '/dashboard'];

                if (currentPath && exitRoutes.includes(currentPath)) {
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
    }, []); // Empty dependency array - run once on mount

    return null;
};

export default CapacitorAppListener;
