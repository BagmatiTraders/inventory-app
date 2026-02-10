import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { useDataStore } from '../store/useDataStore';
import { Receipt, History, Info, Users, CreditCard, ShoppingCart, ChevronRight, Package, Search } from 'lucide-react-native';

const SectionHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
    <View style={styles.sectionHeader}>
        <Icon size={18} color={Colors.primary} style={{ marginRight: 8 }} />
        <Text style={styles.sectionTitle}>{title}</Text>
    </View>
);

export default function PurchaseTransactionScreen() {
    const { todayPurchases, isLoading, transactionSummaries, refreshData, syncPurchasingData } = useDataStore();

    useEffect(() => {
        refreshData();
        syncPurchasingData();
    }, []);

    const onRefresh = async () => {
        await syncPurchasingData();
    };

    const renderTransactionItem = ({ item }: { item: any }) => {
        const isSell = item.purchase_type === 'Sell';
        return (
            <View style={styles.historyItem}>
                <View style={styles.historyMainRow}>
                    <View style={styles.historyLeft}>
                        <Text style={styles.historyProductName} numberOfLines={1}>{item.product?.product_name || item.purchase_name}</Text>
                        <Text style={styles.historySupplierName}>{item.supplier?.supplier_name || 'Others'}</Text>
                        <View style={styles.tagRow}>
                            <View style={[styles.typeTag, isSell ? styles.sellTag : styles.buyTag]}>
                                <Text style={[styles.typeTagText, isSell ? styles.sellTagText : styles.buyTagText]}>
                                    {isSell ? 'SELL' : 'BUY'}
                                </Text>
                            </View>
                            <View style={[
                                styles.paymentTag,
                                item.payment_type === 'Online' ? styles.onlineTag :
                                    item.payment_type === 'Due' ? styles.dueTag : styles.cashTag
                            ]}>
                                <Text style={[
                                    styles.paymentTagText,
                                    item.payment_type === 'Online' ? styles.onlineTagText :
                                        item.payment_type === 'Due' ? styles.dueTagText : styles.cashTagText
                                ]}>
                                    {item.payment_type || 'Cash'}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.historyRight}>
                        <Text style={styles.historyAmount}>Rs {item.total_amount?.toLocaleString()}</Text>
                        <Text style={styles.historyDetails}>{item.quantity} x {item.unit_amount}</Text>
                    </View>
                </View>
            </View>
        );
    };

    const Header = () => (
        <View style={styles.contentContainer}>
            {/* Top Summaries */}
            <View style={styles.summaryContainer}>
                <View style={styles.summaryBox}>
                    <Text style={styles.summaryLabel}>TOTAL PURCHASE</Text>
                    <Text style={styles.summaryValuePurchase}>Rs {transactionSummaries.totalPurchase.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryBox}>
                    <Text style={styles.summaryLabel}>TOTAL SALES</Text>
                    <Text style={styles.summaryValueSales}>Rs {transactionSummaries.totalSales.toLocaleString()}</Text>
                </View>
            </View>

            {/* Payment Analysis */}
            <View style={styles.card}>
                <SectionHeader title="Payment Analysis" icon={CreditCard} />
                <View style={styles.tableHeader}>
                    <Text style={[styles.columnLabel, { flex: 2 }]}>Type</Text>
                    <Text style={[styles.columnLabel, { textAlign: 'right' }]}>Sales</Text>
                    <Text style={[styles.columnLabel, { textAlign: 'right' }]}>Purchase</Text>
                </View>
                <View style={styles.divider} />
                {transactionSummaries.paymentAnalysis.map((item, index) => (
                    <View key={index} style={styles.tableRow}>
                        <View style={styles.typeIconRow}>
                            <CreditCard size={14} color={Colors.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.rowText}>{item.type}</Text>
                        </View>
                        <Text style={[styles.rowText, { textAlign: 'right' }]}>Rs {item.sales.toLocaleString()}</Text>
                        <Text style={[styles.rowText, { textAlign: 'right', color: Colors.primary }]}>Rs {item.purchase.toLocaleString()}</Text>
                    </View>
                ))}
                <View style={styles.dividerBold} />
                <View style={[styles.tableRow, { paddingBottom: 4 }]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={[styles.totalLabel, { textAlign: 'right' }]}>Rs {transactionSummaries.totalSales.toLocaleString()}</Text>
                    <Text style={[styles.totalLabel, { textAlign: 'right', color: Colors.primary }]}>Rs {transactionSummaries.totalPurchase.toLocaleString()}</Text>
                </View>
            </View>

            {/* Supplier Breakdown */}
            <View style={styles.card}>
                <SectionHeader title="Supplier Breakdown" icon={Users} />
                <View style={styles.divider} />
                {transactionSummaries.supplierBreakdown.length > 0 ? (
                    transactionSummaries.supplierBreakdown.map((item, index) => (
                        <View key={index}>
                            <View style={styles.supplierRow}>
                                <View style={styles.supplierInfo}>
                                    <Text style={styles.supplierName} numberOfLines={1}>{item.name}</Text>
                                    <View style={styles.supplierSubInfo}>
                                        <Text style={styles.supplierCount}>({item.count})</Text>
                                        <View style={[styles.smallTypeTag, item.type === 'SELL' ? styles.sellTag : styles.buyTag]}>
                                            <Text style={[styles.smallTypeTagText, item.type === 'SELL' ? styles.sellTagText : styles.buyTagText]}>
                                                {item.type}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <Text style={styles.supplierTotal}>Rs {item.total.toLocaleString()}</Text>
                            </View>
                            {index < transactionSummaries.supplierBreakdown.length - 1 && <View style={styles.dividerDashed} />}
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>No data for today</Text>
                )}
            </View>

            {/* Transaction History Label */}
            <View style={styles.historyLabelContainer}>
                <Text style={styles.historyLabel}>Transaction History</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={todayPurchases}
                keyExtractor={(item) => item.id}
                renderItem={renderTransactionItem}
                ListHeaderComponent={Header}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={onRefresh} colors={[Colors.primary]} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <History size={48} color={Colors.border} />
                        <Text style={styles.emptyText}>No transactions found for today.</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    listContainer: {
        paddingBottom: Spacing.xl,
    },
    contentContainer: {
        // paddingHorizontal: Spacing.md,
    },
    summaryContainer: {
        flexDirection: 'row',
        backgroundColor: '#F8F9FA',
        marginHorizontal: Spacing.md,
        marginVertical: Spacing.md,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: '#EDF2F7',
    },
    summaryBox: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        backgroundColor: '#CBD5E0',
        height: '80%',
        alignSelf: 'center',
    },
    summaryLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#718096',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    summaryValuePurchase: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#3182CE',
    },
    summaryValueSales: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#38A169',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: Radius.lg,
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: '#2D3748', // Dark border matching mock
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A202C',
    },
    divider: {
        height: 1,
        backgroundColor: '#EDF2F7',
        marginVertical: 8,
    },
    dividerBold: {
        height: 1.5,
        backgroundColor: '#2D3748',
        marginVertical: 8,
    },
    dividerDashed: {
        height: 1,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginVertical: 8,
        borderRadius: 1,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 4,
    },
    columnLabel: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: '#4A5568',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    typeIconRow: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowText: {
        flex: 1,
        fontSize: 14,
        color: '#2D3748',
        fontWeight: '500',
    },
    totalLabel: {
        flex: 1,
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1A202C',
    },
    supplierRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    supplierInfo: {
        flex: 1,
    },
    supplierName: {
        fontSize: 15,
        fontWeight: '500',
        color: '#2D3748',
    },
    supplierSubInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    supplierCount: {
        fontSize: 13,
        color: '#A0AEC0',
        marginRight: 6,
    },
    smallTypeTag: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    smallTypeTagText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    supplierTotal: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3182CE',
    },
    historyLabelContainer: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
        backgroundColor: '#F8F9FA',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#2D3748',
    },
    historyLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A202C',
    },
    historyItem: {
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
    },
    historyMainRow: {
        flexDirection: 'row',
        padding: Spacing.md,
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    historyLeft: {
        flex: 1,
    },
    historyProductName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1A202C',
        marginBottom: 2,
    },
    historySupplierName: {
        fontSize: 13,
        color: '#718096',
        marginBottom: 6,
    },
    tagRow: {
        flexDirection: 'row',
        gap: 6,
    },
    typeTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: Radius.sm,
    },
    buyTag: {
        backgroundColor: '#EBF8FF',
    },
    buyTagText: {
        color: '#3182CE',
    },
    sellTag: {
        backgroundColor: '#F0FFF4',
    },
    sellTagText: {
        color: '#38A169',
    },
    typeTagText: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    onlineTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: Radius.sm,
        borderWidth: 1,
        borderColor: '#38A169',
        backgroundColor: '#F0FFF4',
    },
    onlineTagText: {
        fontSize: 11,
        color: '#38A169',
        fontWeight: 'bold',
    },
    paymentTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: Radius.sm,
        borderWidth: 1,
    },
    paymentTagText: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    cashTag: {
        borderColor: '#3182CE',
        backgroundColor: '#EBF8FF',
    },
    cashTagText: {
        color: '#3182CE',
    },
    dueTag: {
        borderColor: '#E53E3E',
        backgroundColor: '#FFF5F5',
    },
    dueTagText: {
        color: '#E53E3E',
    },
    historyRight: {
        alignItems: 'flex-end',
    },
    historyAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A202C',
    },
    historyDetails: {
        fontSize: 12,
        color: '#A0AEC0',
        marginTop: 2,
    },
    emptyContainer: {
        marginTop: 60,
        alignItems: 'center',
        padding: Spacing.xl,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 14,
        color: '#A0AEC0',
        textAlign: 'center',
    },
});
