import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Main App Screens
import TabNavigator from './TabNavigator';
import DarazDetailScreen from '../screens/DarazDetailScreen';
import StoreSalesDetailScreen from '../screens/StoreSalesDetailScreen';
import DailySalesScreen from '../screens/DailySalesScreen';
import DailyPurchaseTabs from './DailyPurchaseTabs';
import AllPurchaseTabs from './AllPurchaseTabs';
import DateTransactionScreen from '../screens/DateTransactionScreen';
import InventoryPriceReportsScreen from '../screens/InventoryPriceReportsScreen';
import SupplierDetailScreen from '../screens/SupplierDetailScreen';
import AddSupplierTransactionScreen from '../screens/AddSupplierTransactionScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StockAdjustmentTabs from './StockAdjustmentTabs';
import CaptureScreen from '../screens/CaptureScreen';
import InventoryListScreen from '../screens/InventoryListScreen';
import ProfitTrackerTabs from './ProfitTrackerTabs';

export type RootStackParamList = {
    Main: undefined;
    DailySales: undefined;
    InventoryPriceReports: undefined;
    SupplierDetail: { supplierId: string; supplierName: string };
    AddSupplierTransaction: { supplierId: string; supplierName: string };
    Profile: undefined;
    StockAdjustment: undefined;
    Capture: undefined;
    InventoryList: undefined;
    ProfitTracker: undefined;
};

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) return null;

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!session ? (
                // Auth Flow
                <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Signup" component={SignupScreen} />
                </>
            ) : (
                // App Flow
                <>
                    <Stack.Screen name="MainTabs" component={TabNavigator} />
                    <Stack.Screen name="DarazDetail" component={DarazDetailScreen} />
                    <Stack.Screen name="StoreSalesDetail" component={StoreSalesDetailScreen} />
                    <Stack.Screen name="DailySales" component={DailySalesScreen} />
                    <Stack.Screen name="DailyPurchaseTabs" component={DailyPurchaseTabs} />
                    <Stack.Screen name="AllPurchaseTabs" component={AllPurchaseTabs} />
                    <Stack.Screen name="DateTransaction" component={DateTransactionScreen} />
                    <Stack.Screen name="InventoryPriceReports" component={InventoryPriceReportsScreen} />
                    <Stack.Screen name="SupplierDetail" component={SupplierDetailScreen} />
                    <Stack.Screen name="AddSupplierTransaction" component={AddSupplierTransactionScreen} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                    <Stack.Screen name="StockAdjustment" component={StockAdjustmentTabs} />
                    <Stack.Screen name="Capture" component={CaptureScreen} />
                    <Stack.Screen name="InventoryList" component={InventoryListScreen} />
                    <Stack.Screen name="ProfitTracker" component={ProfitTrackerTabs} />
                </>
            )}
        </Stack.Navigator>
    );
}
