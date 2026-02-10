import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { useDataStore } from '../store/useDataStore';
import { ShoppingBag, CreditCard, User, Plus } from 'lucide-react-native';
import AddPurchaseModal from './AddPurchaseModal';
import PurchaseDetailModal from './PurchaseDetailModal';
import { Purchase } from '../db/purchaseRepo';

export default function TodayPurchaseScreen() {
    const { todayPurchases, isLoading, refreshData, syncPurchasingData } = useDataStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

    useEffect(() => {
        refreshData();
        syncPurchasingData();
        const unsubscribe = useDataStore.getState().subscribeToChanges();
        return unsubscribe;
    }, []);

    const onRefresh = async () => {
        await syncPurchasingData();
    };

    const renderItem = ({ item }: { item: Purchase }) => {
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                    setSelectedPurchase(item);
                    setDetailVisible(true);
                }}
            >
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.productInfo}>
                            <ShoppingBag size={18} color={Colors.primary} />
                            <Text style={styles.productName} numberOfLines={1} ellipsizeMode="tail">{item.product?.product_name || 'Unknown Product'}</Text>
                        </View>
                        <Text style={styles.amount}>Rs {item.total_amount?.toLocaleString()}</Text>
                    </View>

                    <View style={styles.detailsGrid}>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Qty</Text>
                            <Text style={styles.detailValue}>{item.quantity}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Rate</Text>
                            <Text style={styles.detailValue}>{item.unit_amount?.toLocaleString()}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Type</Text>
                            <View style={[styles.badge, item.purchase_type === 'Sell' ? styles.sellBadge : styles.buyBadge]}>
                                <Text style={[styles.badgeText, item.purchase_type === 'Sell' ? styles.sellText : styles.buyText]}>
                                    {item.purchase_type || 'Buy'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <View style={styles.footerItem}>
                            <User size={14} color={Colors.textSecondary} />
                            <Text style={styles.footerText}>{item.supplier?.supplier_name || 'N/A'}</Text>
                        </View>
                        <View style={styles.footerItem}>
                            <CreditCard size={14} color={Colors.textSecondary} />
                            <Text style={styles.footerText}>{item.payment_type || 'Cash'}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, (detailVisible || modalVisible) && styles.dimmedContainer]}>
            <View style={styles.summaryBar}>
                <Text style={styles.summaryTitle}>Today's Total Entries</Text>
                <Text style={styles.summaryValue}>{todayPurchases.length}</Text>
            </View>

            <FlatList
                data={todayPurchases}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={onRefresh} colors={[Colors.primary]} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No purchases entered today.</Text>
                    </View>
                }
            />

            <TouchableOpacity
                style={styles.fab}
                onPress={() => setModalVisible(true)}
            >
                <Plus size={30} color={Colors.primary} strokeWidth={2.5} />
            </TouchableOpacity>

            <AddPurchaseModal
                visible={modalVisible}
                onClose={() => {
                    setModalVisible(false);
                    setSelectedPurchase(null);
                }}
                editPurchase={selectedPurchase}
            />

            <PurchaseDetailModal
                visible={detailVisible}
                purchase={selectedPurchase}
                onClose={() => {
                    setDetailVisible(false);
                    setSelectedPurchase(null);
                }}
                onEdit={(purchase) => {
                    setDetailVisible(false);
                    setSelectedPurchase(purchase);
                    setModalVisible(true);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    dimmedContainer: {
        opacity: 0.3, // Dim background when modal is open
        backgroundColor: '#000000',
    },
    summaryBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: Colors.primarySoft,
        margin: Spacing.md,
        borderRadius: Radius.md,
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    listContent: {
        padding: Spacing.md,
        paddingTop: 0,
    },
    card: {
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    productInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    productName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.text,
        flex: 1,
    },
    amount: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.success,
    },
    detailsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: Colors.background,
        padding: Spacing.sm,
        borderRadius: Radius.md,
        marginBottom: Spacing.md,
    },
    detailItem: {
        alignItems: 'center',
        flex: 1,
    },
    detailLabel: {
        fontSize: 10,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Colors.text,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: Radius.round,
    },
    buyBadge: {
        backgroundColor: Colors.primarySoft,
    },
    sellBadge: {
        backgroundColor: Colors.warningSoft,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    buyText: {
        color: Colors.info,
    },
    sellText: {
        color: Colors.warning,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingTop: Spacing.sm,
    },
    footerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    footerText: {
        fontSize: 11,
        color: Colors.textSecondary,
    },
    emptyContainer: {
        marginTop: 60,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 56,
        height: 56,
        backgroundColor: Colors.primarySoft,
        borderRadius: Radius.md, // Rectangle with curve
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 6,
        borderWidth: 1,
        borderColor: '#E3F2FD',
    },
});
