import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { List, Repeat, Calendar, ChevronLeft } from 'lucide-react-native';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';

// Screens
import DailyPurchaseListScreen from '../screens/DailyPurchaseListScreen';
import PurchaseTransactionScreen from '../screens/PurchaseTransactionScreen';
import TodayPurchaseScreen from '../screens/TodayPurchaseScreen';

const Tab = createBottomTabNavigator();

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 4,
    },
    leftSlot: {
        width: 50,
        alignItems: 'flex-start',
    },
    centerSlot: {
        flex: 1,
        alignItems: 'center',
    },
    rightSlot: {
        width: 50,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
        textAlign: 'center',
    },
    backButton: {
        padding: 4,
    },
});

const PurchaseHeader = ({
    title,
    onBack,
    renderRight
}: {
    title: string;
    onBack: () => void;
    renderRight?: (props: any) => React.ReactNode
}) => {
    const insets = useSafeAreaInsets();
    return (
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
            <View style={styles.leftSlot}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
            </View>
            <View style={styles.centerSlot}>
                <Text style={styles.headerTitle}>{title}</Text>
            </View>
            <View style={styles.rightSlot}>
                {renderRight?.({})}
            </View>
        </View>
    );
};

export default function DailyPurchaseTabs() {
    const navigation = useNavigation();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: true,
                header: ({ options, route }) => (
                    <PurchaseHeader
                        title={options.headerTitle as string || "Daily Purchase List"}
                        onBack={() => navigation.goBack()}
                        renderRight={options.headerRight}
                    />
                ),
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textSecondary,
                tabBarStyle: {
                    backgroundColor: Colors.card,
                    borderTopWidth: 1,
                    borderTopColor: Colors.border,
                    height: 110,
                    paddingBottom: 45,
                    paddingTop: 10,
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
            <Tab.Screen
                name="List"
                component={DailyPurchaseListScreen}
                options={{
                    tabBarIcon: ({ color }) => <List size={24} color={color} />,
                    headerTitle: "Daily Purchase List",
                }}
            />
            <Tab.Screen
                name="Transaction"
                component={PurchaseTransactionScreen}
                options={{
                    tabBarIcon: ({ color }) => <Repeat size={24} color={color} />,
                    headerTitle: "Purchase Transactions",
                }}
            />
            <Tab.Screen
                name="Today"
                component={TodayPurchaseScreen}
                options={{
                    tabBarIcon: ({ color }) => <Calendar size={24} color={color} />,
                    headerTitle: "Today's Purchases",
                }}
            />
        </Tab.Navigator>
    );
}
