import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, ShoppingCart, Repeat, MoreHorizontal } from 'lucide-react-native';
import { Colors } from '../theme/colors';

// Screens
import HomeScreen from '../screens/HomeScreen';
import PurchasingScreen from '../screens/PurchasingScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import MoreScreen from '../screens/MoreScreen';

import { AppHeader } from '../components/AppHeader';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: true,
                tabBarIcon: ({ color }) => {
                    const iconSize = 24;
                    if (route.name === 'Home') {
                        return <Home size={iconSize} color={color} />;
                    } else if (route.name === 'Purchasing') {
                        return <ShoppingCart size={iconSize} color={color} />;
                    } else if (route.name === 'Transactions') {
                        return <Repeat size={iconSize} color={color} />;
                    } else if (route.name === 'More') {
                        return <MoreHorizontal size={iconSize} color={color} />;
                    }
                },
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textSecondary,
                header: () => <AppHeader />,
                tabBarStyle: {
                    backgroundColor: Colors.card,
                    borderTopWidth: 1,
                    borderTopColor: Colors.border,
                    height: 110, // Increased for significant clearance
                    paddingBottom: 45, // Heavy padding for system bars
                    paddingTop: 10,
                    // Shadow for footer
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 20,
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
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
            <Tab.Screen name="Purchasing" component={PurchasingScreen} options={{ title: 'Purchasing' }} />
            <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transactions' }} />
            <Tab.Screen name="More" component={MoreScreen} options={{ title: 'More' }} />
        </Tab.Navigator >
    );
}
