import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ArrowUpCircle, ArrowDownCircle, Info, Package, Loader2, Plus, Receipt } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { SupplierRepo } from '../db/supplierRepo';
import AddPurchaseModal from './AddPurchaseModal';

type RootStackParamList = {
    SupplierDetail: { supplierId: string; supplierName: string };
};

type SupplierDetailRouteProp = RouteProp<RootStackParamList, 'SupplierDetail'>;

import { RootStackParamList as GlobalRootStackParamList } from '../navigation/RootNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProp = NativeStackNavigationProp<GlobalRootStackParamList, 'SupplierDetail'>;

type LedgerDetailType = 'CASH_BUY' | 'CASH_SELL' | 'DUE_SELL' | 'DUE_BUY' | 'PAID' | 'RECEIVED';

export default function SupplierDetailScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<SupplierDetailRouteProp>();
    const { supplierId, supplierName: initialName } = route.params;

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [supplierName, setSupplierName] = useState(initialName);
    const [activeTab, setActiveTab] = useState<LedgerDetailType>('CASH_BUY');
    const [transactions, setTransactions] = useState<any[]>([]);
    const [transLoading, setTransLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);

    const fetchStats = async () => {
        try {
            const data = await SupplierRepo.getSupplierStats(supplierId);
            setStats(data.stats);
            setSupplierName(data.supplierName);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
            Alert.alert('Error', 'Failed to load supplier statistics.');
        } finally {
            setLoading(false);
        }
    };

    const fetchTransactions = async (isNewTab = false) => {
        if (transLoading) return;
        setTransLoading(true);

        try {
            const from = isNewTab ? 0 : transactions.length;
            const to = from + 19;
            const data = await SupplierRepo.getSupplierDetailedTransactions(supplierId, activeTab, from, to);

            if (isNewTab) {
                setTransactions(data.transactions);
            } else {
                setTransactions(prev => [...prev, ...data.transactions]);
            }
            setHasMore(data.transactions.length === 20);
        } catch (error) {
            console.error('Failed to fetch transactions:', error);
        } finally {
            setTransLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        fetchTransactions(true);
    }, [activeTab]);

    const totalDebit = (stats?.cashBuy || 0) + (stats?.cashSell || 0) + (stats?.dueSell || 0) + (stats?.paid || 0);
    const totalCredit = (stats?.cashBuy || 0) + (stats?.cashSell || 0) + (stats?.dueBuy || 0) + (stats?.received || 0);
    const runningBalance = (stats?.openingBalance || 0) + totalCredit - totalDebit;

    const renderSummaryCard = (title: string, color: string, total: number, items: { label: string; value: number; isBold?: boolean }[]) => (
        <View style={[styles.summaryCard, { borderLeftColor: color }]}>
            <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>{title}</Text>
                <View style={styles.totalContainer}>
                    <Text style={styles.totalLabel}>TOTAL</Text>
                    <Text style={[styles.totalValue, { color }]}>रु {total.toLocaleString()}</Text>
                </View>
            </View>
            <View style={styles.summaryItems}>
                {items.map((item, index) => (
                    <View key={index} style={[styles.summaryItem, item.isBold && styles.summaryItemBold]}>
                        <Text style={styles.itemLabel}>{item.label}</Text>
                        <Text style={[styles.itemValue, item.isBold && { color, fontWeight: 'bold' }]}>
                            रु {item.value.toLocaleString()}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );

    const tabs: { type: LedgerDetailType; label: string }[] = [
        { type: 'CASH_BUY', label: 'Cash Buy' },
        { type: 'CASH_SELL', label: 'Cash Sell' },
        { type: 'DUE_SELL', label: 'Due Sell' },
        { type: 'DUE_BUY', label: 'Due Buy' },
        { type: 'PAID', label: 'Paid Amount' },
        { type: 'RECEIVED', label: 'Received Amount' },
    ];

    const renderTransactionItem = ({ item }: { item: any }) => (
        <View style={styles.transactionItem}>
            <View style={styles.transMain}>
                <View>
                    <Text style={styles.transDate}>{item.date}</Text>
                    <Text style={styles.transDesc} numberOfLines={2}>{item.description}</Text>
                    <Text style={styles.transRef}>{item.reference}</Text>
                </View>
                <Text style={styles.transAmount}>रु {Number(item.amount).toLocaleString()}</Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.supplierName} numberOfLines={1}>{supplierName}</Text>
                    <Text style={styles.headerSub}>Supplier Ledger Detail</Text>
                </View>
                <View style={styles.balanceContainer}>
                    <Text style={styles.balanceLabel}>RUNNING BALANCE</Text>
                    <Text style={[
                        styles.balanceValue,
                        { color: runningBalance > 1 ? Colors.danger : runningBalance < -1 ? Colors.success : Colors.text }
                    ]}>
                        रु {Math.abs(runningBalance).toLocaleString()}
                    </Text>
                </View>
            </View>

            <ScrollView style={styles.flex} stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
                {/* Summary Cards */}
                <View style={styles.summaryGrid}>
                    {renderSummaryCard('DEBIT SIDE', Colors.primary, totalDebit, [
                        { label: 'Cash Buy', value: stats?.cashBuy || 0 },
                        { label: 'Cash Sell', value: stats?.cashSell || 0 },
                        { label: 'Due Sell', value: stats?.dueSell || 0 },
                        { label: 'Paid Amount', value: stats?.paid || 0, isBold: true },
                    ])}
                    {renderSummaryCard('CREDIT SIDE', Colors.success, totalCredit, [
                        { label: 'Cash Buy', value: stats?.cashBuy || 0 },
                        { label: 'Cash Sell', value: stats?.cashSell || 0 },
                        { label: 'Due Buy', value: stats?.dueBuy || 0 },
                        { label: 'Received Amount', value: stats?.received || 0, isBold: true },
                    ])}
                </View>

                {/* Tabs */}
                <View style={styles.tabsWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
                        {tabs.map(tab => (
                            <TouchableOpacity
                                key={tab.type}
                                style={[styles.tabButton, activeTab === tab.type && styles.tabButtonActive]}
                                onPress={() => setActiveTab(tab.type)}
                            >
                                <Text style={[styles.tabText, activeTab === tab.type && styles.tabTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Transaction List */}
                <View style={styles.listSection}>
                    {transactions.length === 0 && !transLoading ? (
                        <View style={styles.emptyContainer}>
                            <Package size={40} color={Colors.border} />
                            <Text style={styles.emptyText}>No records found</Text>
                        </View>
                    ) : (
                        <View>
                            {transactions.map((item, index) => (
                                <View key={item.id || index}>
                                    {renderTransactionItem({ item })}
                                </View>
                            ))}
                            {hasMore && (
                                <TouchableOpacity
                                    style={styles.loadMore}
                                    onPress={() => fetchTransactions()}
                                    disabled={transLoading}
                                >
                                    {transLoading ? (
                                        <ActivityIndicator size="small" color={Colors.primary} />
                                    ) : (
                                        <Text style={styles.loadMoreText}>Load More</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Sticky Footer Actions */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.footerButton, styles.buttonTransaction]}
                    onPress={() => navigation.navigate('AddSupplierTransaction', { supplierId, supplierName })}
                >
                    <Receipt size={20} color={Colors.primary} />
                    <Text style={[styles.footerButtonText, { color: Colors.primary }]}>+ Payment Transaction</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.footerButton, styles.buttonBuySell]}
                    onPress={() => setShowPurchaseModal(true)}
                >
                    <Plus size={20} color={Colors.success} />
                    <Text style={[styles.footerButtonText, { color: Colors.success }]}>+ Buy / Sell</Text>
                </TouchableOpacity>
            </View>

            <AddPurchaseModal
                visible={showPurchaseModal}
                onClose={() => setShowPurchaseModal(false)}
                defaultSupplierId={supplierId}
                defaultSupplierName={supplierName}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    flex: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backButton: {
        marginRight: Spacing.sm,
    },
    headerContent: {
        flex: 1,
    },
    supplierName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    headerSub: {
        fontSize: 11,
        color: Colors.textSecondary,
    },
    balanceContainer: {
        alignItems: 'flex-end',
    },
    balanceLabel: {
        fontSize: 9,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    balanceValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    summaryGrid: {
        padding: Spacing.md,
        gap: Spacing.md,
    },
    summaryCard: {
        backgroundColor: Colors.card,
        borderRadius: Radius.md,
        padding: Spacing.md,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    summaryTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.textSecondary,
    },
    totalContainer: {
        alignItems: 'flex-end',
    },
    totalLabel: {
        fontSize: 8,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    totalValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    summaryItems: {
        gap: Spacing.xs,
    },
    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryItemBold: {
        marginTop: Spacing.xs,
        paddingTop: Spacing.xs,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    itemLabel: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    itemValue: {
        fontSize: 13,
        color: Colors.text,
    },
    tabsWrapper: {
        backgroundColor: Colors.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    tabsContent: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        gap: Spacing.sm,
    },
    tabButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: Radius.round,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    tabButtonActive: {
        backgroundColor: Colors.text,
        borderColor: Colors.text,
    },
    tabText: {
        fontSize: 12,
        fontWeight: '500',
        color: Colors.textSecondary,
    },
    tabTextActive: {
        color: '#FFF',
    },
    listSection: {
        flex: 1,
        padding: Spacing.md,
    },
    transactionItem: {
        backgroundColor: Colors.card,
        padding: Spacing.md,
        borderRadius: Radius.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    transMain: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    transDate: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 2,
    },
    transDesc: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
        maxWidth: '80%',
    },
    transRef: {
        fontSize: 11,
        color: Colors.primary,
        marginTop: 2,
    },
    transAmount: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.text,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
    },
    emptyText: {
        marginTop: Spacing.sm,
        color: Colors.textSecondary,
        fontSize: 14,
    },
    loadMore: {
        alignItems: 'center',
        padding: Spacing.md,
    },
    loadMoreText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        padding: Spacing.md,
        backgroundColor: Colors.card,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        gap: Spacing.md,
        // Shadow for footer
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 10,
    },
    footerButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: Radius.md,
        gap: 8,
    },
    buttonTransaction: {
        backgroundColor: Colors.primary + '15', // Light highlight (15% opacity)
    },
    buttonBuySell: {
        backgroundColor: Colors.success + '15', // Light highlight (15% opacity)
    },
    footerButtonText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
});
