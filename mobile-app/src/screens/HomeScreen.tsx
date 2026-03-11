import React from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, User, Plus, Camera, Sliders, Receipt, Users, ChevronRight } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { SummaryCard } from '../components/SummaryCard';
import { ShortcutButton } from '../components/ShortcutButton';
import { useNavigation } from '@react-navigation/native';
import { useDataStore } from '../store/useDataStore';
import AddProductModal from './AddProductModal';
import AddSupplierModal from './AddSupplierModal';

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const { products, transactions, darazSummary, marketplaceSummary, storeSales, isLoading, refreshData } = useDataStore();
    const [addProductVisible, setAddProductVisible] = React.useState(false);
    const [addSupplierVisible, setAddSupplierVisible] = React.useState(false);

    React.useEffect(() => {
        refreshData();
    }, []);

    const handlePress = (label: string) => {
        if (label === 'Daraz Summary') {
            navigation.navigate('DarazDetail');
        } else if (label === 'Store Sales Summary') {
            navigation.navigate('StoreSalesDetail');
        } else if (label === 'Inventory List') {
            navigation.navigate('InventoryList');
        } else if (label === 'Add Product') {
            setAddProductVisible(true);
        } else if (label === 'Add Suppliers') {
            setAddSupplierVisible(true);
        } else if (label === 'Adjust Stock') {
            navigation.navigate('StockAdjustment');
        } else if (label === 'Capture') {
            navigation.navigate('Capture');
        } else if (label === 'Expense') {
            navigation.navigate('Expense');
        } else if (label === 'Reminder') {
            navigation.navigate('Reminder');
        } else {
            Alert.alert('Coming Soon', `${label} detail view is under development.`);
        }
    };

    // Derived summary data (would be more complex in real app)
    // Derived summary data (Today's Store Sales)
    const today = new Date().toISOString().split('T')[0];
    const todayStoreSales = (storeSales || []).filter(s => s.sale_date === today);
    const storeSalesQty = todayStoreSales.reduce((acc, s) => acc + 1, 0);
    const storeSalesAmount = todayStoreSales.reduce((acc, s) => acc + (s.total_amount || 0), 0);

    return (
        <SafeAreaView style={styles.safeArea} edges={[]}>
            <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={refreshData} />
                }
            >
                <Text style={styles.sectionTitle}>Today Order Summary</Text>

                {/* Summary Cards Section */}
                <SummaryCard
                    title="Daraz"
                    backgroundColor={Colors.primarySoft}
                    items={[
                        { label: 'Pending', value: darazSummary?.pending || 0, color: Colors.warning },
                        { label: 'Packed', value: darazSummary?.packed || 0, color: Colors.info },
                        { label: 'RTS', value: darazSummary?.readyToShip || 0, color: Colors.primary },
                        { label: 'Shipped', value: darazSummary?.shipped || 0, color: Colors.success }
                    ]}
                    onPress={() => handlePress('Daraz Summary')}
                />

                <SummaryCard
                    title="Marketplace Sales"
                    backgroundColor={Colors.dangerSoft}
                    items={[
                        { label: 'Pending', value: marketplaceSummary?.pending || 0, color: Colors.warning },
                        { label: 'Shipped', value: marketplaceSummary?.shipped || 0, color: Colors.success }
                    ]}
                    onPress={() => handlePress('Marketplace Summary')}
                />

                <SummaryCard
                    title="Store Sales"
                    backgroundColor={Colors.successSoft}
                    items={[
                        { label: 'Sales Qty', value: storeSalesQty, color: Colors.text },
                        { label: 'Sales Amount', value: `रु ${storeSalesAmount.toLocaleString()}`, color: Colors.success }
                    ]}
                    onPress={() => handlePress('Store Sales Summary')}
                />

                {/* Middle Navigation Cards */}
                <TouchableOpacity style={styles.navCard} onPress={() => handlePress('Inventory List')}>
                    <Text style={styles.navCardText}>Inventory List</Text>
                    <ChevronRight size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.navCard} onPress={() => handlePress('Stock Ledger')}>
                    <Text style={styles.navCardText}>Stock Ledger</Text>
                    <ChevronRight size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('DailySales')}>
                    <Text style={styles.navCardText}>Daily Sales</Text>
                    <ChevronRight size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                {/* Shortcuts Grid */}
                <Text style={styles.sectionTitle}>Shortcuts</Text>
                <View style={styles.shortcutsGrid}>
                    <ShortcutButton
                        label="Add Product"
                        icon={<Plus size={24} color={Colors.primary} />}
                        onPress={() => handlePress('Add Product')}
                    />
                    <ShortcutButton
                        label="Capture"
                        icon={<Camera size={24} color={Colors.primary} />}
                        onPress={() => handlePress('Capture')}
                    />
                    <ShortcutButton
                        label="Adjust Stock"
                        icon={<Sliders size={24} color={Colors.primary} />}
                        onPress={() => handlePress('Adjust Stock')}
                    />
                    <ShortcutButton
                        label="Expense"
                        icon={<Receipt size={24} color={Colors.danger} />}
                        onPress={() => handlePress('Expense')}
                        color={Colors.dangerSoft}
                    />
                    <ShortcutButton
                        label="Reminder"
                        icon={<Bell size={24} color={Colors.primary} />}
                        onPress={() => handlePress('Reminder')}
                    />
                    <ShortcutButton
                        label="Add Suppliers"
                        icon={<Users size={24} color={Colors.primary} />}
                        onPress={() => handlePress('Add Suppliers')}
                    />
                </View>

                <AddProductModal
                    visible={addProductVisible}
                    onClose={() => setAddProductVisible(false)}
                />

                <AddSupplierModal
                    visible={addSupplierVisible}
                    onClose={() => setAddSupplierVisible(false)}
                />

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.card,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        // Add subtle shadow for "fixed" feel
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 4,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    profileIcon: {
        width: 40, // Slightly bigger
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileInitial: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    businessName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    iconButton: {
        padding: 4,
    },
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        paddingHorizontal: Spacing.md,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
    },
    navCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.card,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        marginVertical: Spacing.xs,
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    navCardText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    shortcutsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 8,
        marginTop: Spacing.sm,
    },
});
