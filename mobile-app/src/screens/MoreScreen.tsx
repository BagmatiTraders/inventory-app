import React from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, ChevronRight, Settings, CreditCard, BarChart2, RefreshCcw, LogOut, TrendingUp, Receipt, Bell } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/RootNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;
import { Spacing, Radius } from '../theme/spacing';

export default function MoreScreen() {
    const navigation = useNavigation<NavigationProp>();
    const [user, setUser] = React.useState<any>(null);

    React.useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });
    }, []);

    const handlePress = (label: string) => {
        if (label === 'My Account') {
            navigation.navigate('Profile');
        } else if (label === 'Profit Tracker') {
            navigation.navigate('ProfitTracker' as any);
        } else if (label === 'Expenses') {
            navigation.navigate('Expense');
        } else if (label === 'Reminder') {
            navigation.navigate('Reminder');
        } else if (label === 'Account / Billing') {
            navigation.navigate('AccountBilling');
        } else {
            Alert.alert('Menu Item Clicked', `You pressed ${label}`);
        }
    };

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await supabase.auth.signOut();
                        if (error) Alert.alert('Error', error.message);
                    }
                }
            ]
        );
    };

    const menuGroups = [
        {
            title: 'Account',
            items: [
                { label: 'My Account', icon: <User size={20} color={Colors.text} /> }
            ]
        },
        {
            title: 'Management',
            items: [
                { label: 'Expenses', icon: <Receipt size={20} color={Colors.danger} /> },
                { label: 'Reminder', icon: <Bell size={20} color={Colors.warning || '#F59E0B'} /> },
                { label: 'Order Status Sync', icon: <RefreshCcw size={20} color={Colors.primary} /> },
                { label: 'Profit Tracker', icon: <TrendingUp size={20} color={Colors.success} /> },
                { label: 'Account / Billing', icon: <CreditCard size={20} color={Colors.text} /> },
                { label: 'View Reports', icon: <BarChart2 size={20} color={Colors.success} /> },
                { label: 'Settings', icon: <Settings size={20} color={Colors.textSecondary} /> },
            ]
        }
    ];

    return (
        <SafeAreaView style={styles.safeArea} edges={[]}>
            <ScrollView style={styles.container}>
                {/* Profile Header */}
                <View style={styles.profileSection}>
                    <TouchableOpacity style={styles.avatar} onPress={() => handlePress('Avatar')}>
                        <User size={40} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.userName}>{user?.email || 'Bagmati Traders'}</Text>
                    <View style={styles.roleBadge}>
                        <Text style={styles.roleText}>{user ? 'User' : 'Admin'}</Text>
                    </View>
                </View>

                {/* Menu Groups */}
                {menuGroups.map((group, gIndex) => (
                    <View key={gIndex} style={styles.groupContainer}>
                        <Text style={styles.groupTitle}>{group.title}</Text>
                        <View style={styles.card}>
                            {group.items.map((item, iIndex) => (
                                <TouchableOpacity
                                    key={iIndex}
                                    style={[
                                        styles.menuItem,
                                        iIndex < group.items.length - 1 && styles.menuItemBorder
                                    ]}
                                    onPress={() => handlePress(item.label)}
                                >
                                    <View style={styles.menuIconText}>
                                        {item.icon}
                                        <Text style={styles.menuLabel}>{item.label}</Text>
                                    </View>
                                    <ChevronRight size={20} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                {/* Sign Out Section */}
                <View style={styles.groupContainer}>
                    <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                        <LogOut size={20} color={Colors.danger} style={{ marginRight: 12 }} />
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    container: {
        flex: 1,
    },
    profileSection: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.sm,
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
    },
    roleBadge: {
        backgroundColor: Colors.primarySoft,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: Radius.round,
        marginTop: 4,
    },
    roleText: {
        fontSize: 12,
        color: Colors.primary,
        fontWeight: '600',
    },
    groupContainer: {
        marginTop: Spacing.lg,
        paddingHorizontal: Spacing.md,
    },
    groupTitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
        marginLeft: Spacing.xs,
        textTransform: 'uppercase',
    },
    card: {
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        overflow: 'hidden',
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
    },
    menuItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    menuIconText: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuLabel: {
        fontSize: 16,
        color: Colors.text,
        marginLeft: Spacing.md,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.danger,
        marginTop: Spacing.md,
    },
    signOutText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.danger,
    },
});
