import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ShoppingBag, CreditCard, Calendar } from 'lucide-react-native';
import { Colors } from '../theme/colors';

// Screens
import ProfitOrderScreen from '../screens/ProfitOrderScreen';
import ProfitAccountScreen from '../screens/ProfitAccountScreen';
import ProfitDateScreen from '../screens/ProfitDateScreen';

import { AppHeader } from '../components/AppHeader';

const Tab = createBottomTabNavigator();

export default function ProfitTrackerTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: true,
                tabBarIcon: ({ color }) => {
                    const iconSize = 24;
                    if (route.name === 'Order') {
                        return <ShoppingBag size={iconSize} color={color} />;
                    } else if (route.name === 'Account') {
                        return <CreditCard size={iconSize} color={color} />;
                    } else if (route.name === 'Date') {
                        return <Calendar size={iconSize} color={color} />;
                    }
                },
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textSecondary,
                header: () => <AppHeader />,
                tabBarStyle: {
                    backgroundColor: Colors.card,
                    height: 110,
                    paddingBottom: 45,
                    paddingTop: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -8 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 25,
                    borderTopWidth: 0,
                },
                tabBarItemStyle: {
                    height: 60,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '600',
                },
            })}
        >
            <Tab.Screen name="Order" component={ProfitOrderScreen} options={{ title: 'Order' }} />
            <Tab.Screen name="Account" component={ProfitAccountScreen} options={{ title: 'Account' }} />
            <Tab.Screen name="Date" component={ProfitDateScreen} options={{ title: 'Date' }} />
        </Tab.Navigator >
    );
}
