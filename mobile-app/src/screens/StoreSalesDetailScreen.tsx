import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, FlatList, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Save, Trash2, ShoppingCart, List, Tag, User } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { useNavigation } from '@react-navigation/native';
import { useDataStore } from '../store/useDataStore';
import SearchablePicker from '../components/SearchablePicker';
import { StoreSaleItem } from '../db/storeSalesRepo';

export default function StoreSalesDetailScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { products, addStoreSale, storeSales, refreshData, syncPurchasingData } = useDataStore();
    const [activeTab, setActiveTab] = useState<'Entry' | 'List'>('Entry');
    const [isLoading, setIsLoading] = useState(false);

    // Entry Form State
    const [customerName, setCustomerName] = useState('');
    const [selectedItems, setSelectedItems] = useState<StoreSaleItem[]>([]);

    // Item Input State
    const [productPickerVisible, setProductPickerVisible] = useState(false);
    const [currentProduct, setCurrentProduct] = useState<{ id: string, name: string } | null>(null);
    const [qty, setQty] = useState('');
    const [amount, setAmount] = useState('');

    const handleRefresh = async () => {
        setIsLoading(true);
        await syncPurchasingData();
        setIsLoading(false);
    };

    useEffect(() => {
        handleRefresh();
    }, []);

    const handleAddItem = () => {
        if (!currentProduct || !qty || !amount) {
            Alert.alert('Missing Info', 'Please select a product, quantity, and amount.');
            return;
        }

        const newItem: StoreSaleItem = {
            id: Date.now().toString(), // Temp ID
            sale_id: '',
            product_id: currentProduct.id,
            product_name: currentProduct.name,
            qty: parseFloat(qty),
            amount: parseFloat(amount)
        };

        setSelectedItems([...selectedItems, newItem]);
        setCurrentProduct(null);
        setQty('');
        setAmount('');
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...selectedItems];
        newItems.splice(index, 1);
        setSelectedItems(newItems);
    };

    const handleSaveSale = async () => {
        if (selectedItems.length === 0) {
            Alert.alert('Empty Sale', 'Please add at least one item to the sale.');
            return;
        }

        setIsLoading(true);
        try {
            const totalAmount = selectedItems.reduce((sum, item) => sum + (item.qty * item.amount), 0);

            await addStoreSale({
                sale_date: new Date().toISOString().split('T')[0],
                customer_name: customerName.trim() || 'User',
                payment_type: 'Cash',
                remarks: '',
                total_amount: totalAmount,
                items: selectedItems
            });

            Alert.alert('Success', 'Store sale recorded successfully');
            setCustomerName('');
            setSelectedItems([]);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save store sale');
        } finally {
            setIsLoading(false);
        }
    };

    const calculateTotal = () => {
        return selectedItems.reduce((sum, item) => sum + (item.qty * item.amount), 0);
    };

    const renderEntryTab = () => (
        <ScrollView
            style={styles.contentContainer}
            contentContainerStyle={{
                paddingBottom: 100 + insets.bottom // Dynamic padding based on safe area
            }}
        >
            {/* Customer Info */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Customer Details</Text>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Customer Name (Optional)</Text>
                    <View style={styles.inputWrapper}>
                        <User size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            value={customerName}
                            onChangeText={setCustomerName}
                            placeholder="Enter Name (Default: User)"
                        />
                    </View>
                </View>
            </View>

            {/* Add Item Form */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Add Items</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Product</Text>
                    <TouchableOpacity
                        style={styles.dropdownTrigger}
                        onPress={() => setProductPickerVisible(true)}
                    >
                        <Text style={[styles.dropdownText, !currentProduct && styles.placeholder]}>
                            {currentProduct?.name || 'Select Product...'}
                        </Text>
                        <Tag size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Quantity</Text>
                        <TextInput
                            style={styles.inputBox}
                            value={qty}
                            onChangeText={setQty}
                            keyboardType="numeric"
                            placeholder="Qty"
                        />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Amount</Text>
                        <TextInput
                            style={styles.inputBox}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                            placeholder="Rate"
                        />
                    </View>
                </View>

                <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
                    <Plus size={20} color="#FFF" />
                    <Text style={styles.addItemBtnText}>Add to List</Text>
                </TouchableOpacity>
            </View>

            {/* Selected Items List */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Sale Items ({selectedItems.length})</Text>
                {selectedItems.length > 0 ? (
                    selectedItems.map((item, index) => (
                        <View key={index} style={styles.addedItemRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.addedItemName}>{item.product_name}</Text>
                                <Text style={styles.addedItemDetail}>{item.qty} x Rs. {item.amount}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Text style={styles.addedItemTotal}>Rs. {item.qty * item.amount}</Text>
                                <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                                    <Trash2 size={18} color={Colors.danger} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>No items added yet</Text>
                )}

                {selectedItems.length > 0 && (
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Grand Total</Text>
                        <Text style={styles.grandTotal}>Rs. {calculateTotal()}</Text>
                    </View>
                )}
            </View>

            {/* Recent Transactions Preview */}
            <View style={[styles.card, { marginTop: Spacing.md }]}>
                <Text style={styles.cardTitle}>Recent Transactions</Text>
                {storeSales.slice(0, 5).map((sale) => (
                    <View key={sale.id} style={styles.miniSaleRow}>
                        <View>
                            <Text style={styles.miniSaleName}>{sale.customer_name}</Text>
                            <Text style={styles.miniSaleDate}>{sale.sale_date}</Text>
                        </View>
                        <Text style={styles.miniSaleAmount}>Rs. {sale.total_amount}</Text>
                    </View>
                ))}
            </View>
        </ScrollView>
    );

    const renderListTab = () => (
        <FlatList
            data={storeSales}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
                padding: Spacing.md,
                paddingBottom: 100 + insets.bottom // Dynamic padding
            }}
            refreshing={isLoading}
            onRefresh={handleRefresh}
            renderItem={({ item }) => (
                <View style={styles.saleCard}>
                    <View style={styles.saleHeader}>
                        <View>
                            <Text style={styles.saleCustomer}>{item.customer_name}</Text>
                            <Text style={styles.saleDate}>{item.sale_date}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.saleAmount}>Rs. {item.total_amount}</Text>
                            <Text style={[
                                styles.syncStatus,
                                { color: item.sync_status === 'synced' ? Colors.success : Colors.warning }
                            ]}>
                                {item.sync_status === 'synced' ? 'Synced' : 'Pending'}
                            </Text>
                        </View>
                    </View>
                    {item.items && item.items.length > 0 && (
                        <View style={styles.saleItems}>
                            <Text style={styles.itemsLabel}>Items: </Text>
                            {item.items.map((i, index) => (
                                <Text key={index} style={styles.itemsText} numberOfLines={1}>
                                    • {i.product_name} ({i.qty} x {i.amount})
                                </Text>
                            ))}
                        </View>
                    )}
                </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyListText}>No sales records found</Text>}
        />
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Store Sales</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'Entry' && styles.activeTab]}
                    onPress={() => setActiveTab('Entry')}
                >
                    <ShoppingCart size={18} color={activeTab === 'Entry' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabText, activeTab === 'Entry' && styles.activeTabText]}>Entry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'List' && styles.activeTab]}
                    onPress={() => setActiveTab('List')}
                >
                    <List size={18} color={activeTab === 'List' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabText, activeTab === 'List' && styles.activeTabText]}>List</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
                {activeTab === 'Entry' ? renderEntryTab() : renderListTab()}
            </View>

            {/* Floating Save Button for Entry Tab */}
            {activeTab === 'Entry' && selectedItems.length > 0 && (
                <View style={[styles.floatingFooter, { paddingBottom: insets.bottom + Spacing.md }]}>
                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={handleSaveSale}
                        disabled={isLoading}
                    >
                        <Save size={20} color="#FFF" />
                        <Text style={styles.saveButtonText}>
                            {isLoading ? 'Saving...' : `Save Sale (Rs. ${calculateTotal()})`}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            <SearchablePicker
                visible={productPickerVisible}
                onClose={() => setProductPickerVisible(false)}
                onSelect={(item) => setCurrentProduct(item)}
                items={products.map(p => ({ id: p.id, name: p.name }))}
                title="Select Product"
                placeholder="Search product..."
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.card,
        elevation: 2,
        height: 56,
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
    backButton: { padding: 4 },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        padding: Spacing.xs,
        margin: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        gap: 6,
    },
    activeTab: { backgroundColor: Colors.primarySoft },
    tabText: { fontWeight: '600', color: Colors.textSecondary },
    activeTabText: { color: Colors.primary },
    contentContainer: { padding: Spacing.md },
    card: {
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: Spacing.md, color: Colors.text },
    inputGroup: { marginBottom: Spacing.sm },
    label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.sm,
        height: 44,
    },
    inputIcon: { marginRight: 8 },
    input: { flex: 1, color: Colors.text },
    dropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        height: 44,
    },
    dropdownText: { color: Colors.text },
    placeholder: { color: Colors.textSecondary },
    row: { flexDirection: 'row', gap: Spacing.md },
    inputBox: {
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        height: 44,
        color: Colors.text,
    },
    addItemBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        padding: Spacing.sm,
        borderRadius: Radius.md,
        marginTop: Spacing.sm,
        gap: 8,
    },
    addItemBtnText: { color: '#FFF', fontWeight: 'bold' },
    addedItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    addedItemName: { fontWeight: '600', color: Colors.text },
    addedItemDetail: { fontSize: 12, color: Colors.textSecondary },
    addedItemTotal: { fontWeight: 'bold', color: Colors.text },
    emptyText: { textAlign: 'center', color: Colors.textSecondary, fontStyle: 'italic', padding: Spacing.sm },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.md,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    totalLabel: { fontWeight: 'bold', color: Colors.text },
    grandTotal: { fontSize: 18, fontWeight: 'bold', color: Colors.primary },
    miniSaleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    miniSaleName: { fontWeight: '600', color: Colors.text },
    miniSaleDate: { fontSize: 10, color: Colors.textSecondary },
    miniSaleAmount: { fontWeight: 'bold', color: Colors.success },
    saleCard: {
        backgroundColor: Colors.card,
        borderRadius: Radius.md,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        elevation: 1,
    },
    saleHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    saleCustomer: { fontWeight: 'bold', fontSize: 16, color: Colors.text },
    saleDate: { fontSize: 12, color: Colors.textSecondary },
    saleAmount: { fontWeight: 'bold', fontSize: 16, color: Colors.primary },
    syncStatus: { fontSize: 10, fontWeight: '600' },
    saleItems: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
    itemsLabel: { fontSize: 12, fontWeight: 'bold', color: Colors.textSecondary },
    itemsText: { fontSize: 12, color: Colors.text },
    emptyListText: { textAlign: 'center', marginTop: 40, color: Colors.textSecondary },
    floatingFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.background, // Add background to cover content
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        padding: Spacing.md,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 10,
    },
    saveButton: {
        backgroundColor: Colors.success,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
        borderRadius: Radius.lg,
        gap: 8,
    },
    saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
