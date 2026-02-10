import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator, FlatList, RefreshControl, BackHandler, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { ShoppingBag, X, Calendar, User, Tag, DollarSign, Calculator, ChevronRight, RefreshCw } from 'lucide-react-native';
import { DarazRepo } from '../db/darazRepo';
import { format } from 'date-fns';

export default function ProfitOrderScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, []);

    // Handle Hardware Back Button
    useEffect(() => {
        const backAction = () => {
            if (modalVisible) {
                setModalVisible(false);
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            "hardwareBackPress",
            backAction
        );

        return () => backHandler.remove();
    }, [modalVisible]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const result = await DarazRepo.getProfitTrackerOrders({ limit: 100 });
            setOrders(result.data);
        } catch (error) {
            console.error('Error fetching profit orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const result = await DarazRepo.getProfitTrackerOrders({ limit: 100 });
            setOrders(result.data);
        } catch (error) {
            console.error('Error refreshing profit orders:', error);
        } finally {
            setRefreshing(false);
        }
    }, []);

    const handleSyncFees = async () => {
        if (!selectedOrder) return;
        try {
            setSyncing(true);
            await DarazRepo.syncOrderProfit(selectedOrder.order_number);

            // Refresh the list and current order details
            const result = await DarazRepo.getProfitTrackerOrders({ limit: 100 });
            setOrders(result.data);

            // Find the updated order in the new list
            const updated = result.data.find((o: any) => o.order_primary_id === selectedOrder.order_primary_id);
            if (updated) setSelectedOrder(updated);

            Alert.alert('Success', 'Profit and fees synced successfully');
        } catch (error: any) {
            Alert.alert('Sync Failed', error.message || 'Failed to sync profit');
        } finally {
            setSyncing(false);
        }
    };

    const handleOrderPress = (order: any) => {
        setSelectedOrder(order);
        setModalVisible(true);
    };

    const renderOrderItem = ({ item, index }: { item: any; index: number }) => {
        const deliveredDate = item.delivered_by_daraz || item.delivered_at;
        const formattedDate = deliveredDate ? format(new Date(deliveredDate), 'MMM-dd, h a') : 'N/A';
        const products = item.products || [];
        const mainProduct = products[0]?.product_name || 'Unknown Product';
        const moreProducts = products.length > 1 ? ` (+${products.length - 1} more)` : '';

        return (
            <TouchableOpacity
                style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}
                onPress={() => handleOrderPress(item)}
            >
                <View style={[styles.cell, { flex: 1.5 }]}>
                    <Text style={styles.dateText}>{formattedDate}</Text>
                </View>
                <View style={[styles.cell, { flex: 2.5 }]}>
                    <Text style={styles.productText} numberOfLines={2}>
                        {mainProduct}
                        <Text style={styles.moreText}>{moreProducts}</Text>
                    </Text>
                </View>
                <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
                    <Text style={[styles.profitText, (item.estimated_profit || 0) >= 0 ? styles.profitPositive : styles.profitNegative]}>
                        Rs. {(item.estimated_profit || 0).toLocaleString()}
                    </Text>
                </View>
                <ChevronRight size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={[]}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={[styles.headerCell, { flex: 1.5 }]}>
                        <Text style={styles.headerText}>Delivered Date</Text>
                    </View>
                    <View style={[styles.headerCell, { flex: 2.5 }]}>
                        <Text style={styles.headerText}>Product Name</Text>
                    </View>
                    <View style={[styles.headerCell, { flex: 1, alignItems: 'flex-end' }]}>
                        <Text style={styles.headerText}>Profit</Text>
                    </View>
                    <View style={{ width: 16 }} />
                </View>

                {loading && !refreshing ? (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={orders}
                        renderItem={renderOrderItem}
                        keyExtractor={(item) => item.order_primary_id}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No orders found.</Text>
                            </View>
                        }
                    />
                )}
            </View>

            {/* Order Detail Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Order Details</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        {selectedOrder && (
                            <>
                                <ScrollView style={styles.modalScroll}>
                                    <View style={styles.modalInnerPadding}>
                                        <DetailItem icon={<Tag size={18} color={Colors.primary} />} label="Order Number" value={selectedOrder.order_number} />
                                        <DetailItem icon={<User size={18} color={Colors.primary} />} label="Seller Account" value={selectedOrder.seller_account || 'N/A'} />
                                        <DetailItem icon={<Calendar size={18} color={Colors.primary} />} label="Delivered At" value={selectedOrder.delivered_by_daraz || selectedOrder.delivered_at ? format(new Date(selectedOrder.delivered_by_daraz || selectedOrder.delivered_at), 'yyyy-MM-dd HH:mm') : 'N/A'} />

                                        <View style={styles.divider} />

                                        <DetailItem
                                            icon={<DollarSign size={18} color={Colors.success} />}
                                            label="Product Price"
                                            value={`Rs. ${(selectedOrder.total_revenue || 0).toLocaleString()}`}
                                            isAmount
                                        />
                                        <DetailItem
                                            icon={<Calculator size={18} color={Colors.danger} />}
                                            label="Purchase Cost"
                                            value={`Rs. ${(selectedOrder.total_purchase_cost || 0).toLocaleString()}`}
                                            isAmount
                                        />
                                        <DetailItem
                                            icon={<Calculator size={18} color={Colors.warning} />}
                                            label="Daraz Fees"
                                            value={`Rs. ${(selectedOrder.daraz_fees || 0).toLocaleString()}`}
                                            isAmount
                                        />

                                        <View style={styles.divider} />

                                        <View style={styles.profitHighlight}>
                                            <Text style={styles.profitHighlightLabel}>Total Profit</Text>
                                            <Text style={[styles.profitHighlightValue, (selectedOrder.estimated_profit || 0) >= 0 ? styles.profitPositive : styles.profitNegative]}>
                                                Rs. {(selectedOrder.estimated_profit || 0).toLocaleString()}
                                            </Text>
                                        </View>

                                        <View style={styles.productSection}>
                                            <Text style={styles.sectionTitle}>Products</Text>
                                            {(selectedOrder.products || []).map((p: any, idx: number) => (
                                                <View key={idx} style={styles.productCard}>
                                                    <Text style={styles.productName}>{p.product_name}</Text>
                                                    <View style={styles.productMeta}>
                                                        <Text style={styles.productQty}>Qty: {p.quantity}</Text>
                                                        <Text style={styles.productPrice}>Price: Rs. {p.purchase_price?.toLocaleString() || '0'}</Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </ScrollView>

                                <View style={styles.modalFooter}>
                                    <TouchableOpacity
                                        style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
                                        onPress={handleSyncFees}
                                        disabled={syncing}
                                    >
                                        {syncing ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <RefreshCw size={18} color="#FFF" />
                                        )}
                                        <Text style={styles.syncButtonText}>
                                            {syncing ? 'Syncing...' : 'Sync Fees'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function DetailItem({ icon, label, value, isAmount = false }: any) {
    return (
        <View style={styles.detailItem}>
            <View style={styles.detailLabelRow}>
                {icon}
                <Text style={styles.detailLabel}>{label}</Text>
            </View>
            <Text style={[styles.detailValue, isAmount && styles.amountValue]}>{value}</Text>
        </View>
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
    header: {
        flexDirection: 'row',
        padding: Spacing.md,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerCell: {
        justifyContent: 'center',
    },
    headerText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        textTransform: 'uppercase',
    },
    listContent: {
        paddingBottom: Spacing.xl,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    rowEven: {
        backgroundColor: Colors.card,
    },
    rowOdd: {
        backgroundColor: Colors.background,
    },
    cell: {
        justifyContent: 'center',
    },
    dateText: {
        fontSize: 13,
        color: Colors.text,
    },
    productText: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '500',
    },
    moreText: {
        fontSize: 12,
        color: Colors.primary,
        fontWeight: 'bold',
    },
    profitText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    profitPositive: {
        color: Colors.success,
    },
    profitNegative: {
        color: Colors.danger,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.textSecondary,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.background,
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        height: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        backgroundColor: Colors.card,
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        // Header Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 5,
        zIndex: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
    },
    modalScroll: {
        flex: 1,
    },
    modalInnerPadding: {
        padding: Spacing.lg,
    },
    modalFooter: {
        padding: Spacing.lg,
        backgroundColor: Colors.card,
        // Footer Shadow (Upwards)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 10,
        zIndex: 10,
    },
    syncButton: {
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
        borderRadius: Radius.md,
        gap: Spacing.sm,
    },
    syncButtonDisabled: {
        opacity: 0.7,
    },
    syncButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    detailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
    },
    detailLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginLeft: Spacing.sm,
    },
    detailValue: {
        fontSize: 15,
        color: Colors.text,
        fontWeight: '600',
    },
    amountValue: {
        fontFamily: 'monospace',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: Spacing.md,
    },
    profitHighlight: {
        backgroundColor: Colors.card,
        padding: Spacing.md,
        borderRadius: Radius.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    profitHighlightLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    profitHighlightValue: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    productSection: {
        marginTop: Spacing.lg,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    productCard: {
        backgroundColor: Colors.card,
        padding: Spacing.md,
        borderRadius: Radius.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    productName: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '500',
    },
    productMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.xs,
    },
    productQty: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    productPrice: {
        fontSize: 12,
        color: Colors.primary,
        fontWeight: '600',
    },
});
