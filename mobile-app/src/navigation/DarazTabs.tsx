import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ListChecks, LineChart, FileText, LayoutDashboard, ChevronLeft } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';
import { Spacing } from '../theme/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Specialized Daraz Screens
import DarazOrdersScreen from '../screens/DarazOrdersScreen';
import DailySalesScreen from '../screens/DailySalesScreen';
import DarazSummaryScreen from '../screens/DarazSummaryScreen';
import DarazReportsScreen from '../screens/DarazReportsScreen';

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

const DarazHeader = ({ title, onBack }: { title: string; onBack: () => void }) => {
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
            <View style={styles.rightSlot} />
        </View>
    );
};

export function DarazTabs() {
    const navigation = useNavigation();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: true,
                header: ({ options }) => (
                    <DarazHeader
                        title={options.headerTitle as string || route.name}
                        onBack={() => navigation.goBack()}
                    />
                ),
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textSecondary,
                tabBarStyle: {
                    backgroundColor: Colors.card,
                    borderTopWidth: 1,
                    borderTopColor: Colors.border,
                    height: 110, // Matching main app height
                    paddingBottom: 45, // Matching main app padding
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
                name="Orders"
                component={DarazOrdersScreen}
                options={{
                    tabBarIcon: ({ color }) => <ListChecks size={24} color={color} />,
                    headerTitle: "All Orders",
                }}
            />
            <Tab.Screen
                name="Daily Sales"
                component={DailySalesScreen}
                options={{
                    tabBarIcon: ({ color }) => <LineChart size={24} color={color} />,
                    headerTitle: "Daily Sales Report",
                }}
            />
            <Tab.Screen
                name="Summary"
                component={DarazSummaryScreen}
                options={{
                    tabBarIcon: ({ color }) => <LayoutDashboard size={24} color={color} />,
                    headerTitle: "Orders Summary",
                }}
            />
            <Tab.Screen
                name="Report"
                component={DarazReportsScreen}
                options={{
                    tabBarIcon: ({ color }) => <FileText size={24} color={color} />,
                    headerTitle: "Sales Report",
                }}
            />
        </Tab.Navigator>
    );
}
