import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { CreditCard, User, Users, ChevronLeft, Calendar, History, ShoppingBag } from 'lucide-react-native';
import PurchaseDetailModal from './PurchaseDetailModal';
import AddPurchaseModal from './AddPurchaseModal';
import { Purchase, PurchaseRepo } from '../db/purchaseRepo';
import { useNavigation, useRoute } from '@react-navigation/native';
import { formatDate, parseISO } from '../utils/dateUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SectionHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
    <View style={styles.sectionHeader}>
        <Icon size={18} color={Colors.primary} style={{ marginRight: 8 }} />
        <Text style={styles.sectionTitle}>{title}</Text>
    </View>
);

export default function DateTransactionScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { date } = route.params || { date: new Date().toISOString().split('T')[0] };
    const insets = useSafeAreaInsets();

    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(false);
    const [summaries, setSummaries] = useState({
        totalPurchase: 0,
        totalSales: 0,
        paymentAnalysis: [] as { type: string; sales: number; purchase: number }[],
        supplierBreakdown: [] as { name: string; count: number; type: 'BUY' | 'SELL'; total: number }[],
    });

    const [modalVisible, setModalVisible] = useState(false);
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

    const calculateSummaries = (data: Purchase[]) => {
        let totalPurchase = 0;
        let totalSales = 0;
        const pmMap: Record<string, { sales: number; purchase: number }> = {};
        const sbMap: Record<string, { name: string; count: number; total: number; type: 'BUY' | 'SELL' }> = {};

        data.forEach(p => {
            const amount = p.total_amount || 0;
            const isSell = p.purchase_type === 'Sell';
            const pType = p.payment_type || 'Cash';
            const sName = p.supplier?.supplier_name || p.purchase_name || 'Others';
            const sType: 'BUY' | 'SELL' = isSell ? 'SELL' : 'BUY';
            const sKey = `${sName}_${sType}`;

            if (isSell) totalSales += amount;
            else totalPurchase += amount;

            // Payment Analysis
            if (!pmMap[pType]) pmMap[pType] = { sales: 0, purchase: 0 };
            if (isSell) pmMap[pType].sales += amount;
            else pmMap[pType].purchase += amount;

            // Supplier Breakdown
            if (!sbMap[sKey]) sbMap[sKey] = { name: sName, count: 0, total: 0, type: sType };
            sbMap[sKey].count++;
            sbMap[sKey].total += amount;
        });

        const paymentAnalysis = Object.entries(pmMap).map(([type, data]) => ({ type, ...data }));
        const supplierBreakdown = Object.values(sbMap).sort((a, b) => a.name.localeCompare(b.name));

        setSummaries({
            totalPurchase,
            totalSales,
            paymentAnalysis,
            supplierBreakdown,
        });
    };

    const fetchDatePurchases = useCallback(async () => {
        setLoading(true);
        try {
            const dbData = await PurchaseRepo.getAllPurchasesPaginated(0, 1000, {
                startDate: date,
                endDate: date,
            });
            setPurchases(dbData);
            calculateSummaries(dbData);
        } catch (error) {
            console.error('Fetch date purchases error:', error);
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => {
        fetchDatePurchases();
    }, [fetchDatePurchases]);

    const renderTransactionItem = ({ item }: { item: Purchase }) => {
        const isSell = item.purchase_type === 'Sell';
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                    setSelectedPurchase(item);
                    setDetailVisible(true);
                }}
            >
                <View style={styles.historyItem}>
                    <View style={styles.historyMainRow}>
                        <View style={styles.historyLeft}>
                            <Text style={styles.historyProductName} numberOfLines={1}>
                                {item.product?.product_name || item.purchase_name}
                            </Text>
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
            </TouchableOpacity>
        );
    };

    const Header = () => (
        <View style={styles.dashboardContainer}>
            {/* Top Summaries */}
            <View style={styles.summaryContainer}>
                <View style={styles.summaryBox}>
                    <Text style={styles.summaryLabel}>TOTAL PURCHASE</Text>
                    <Text style={styles.summaryValuePurchase}>Rs {summaries.totalPurchase.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryBox}>
                    <Text style={styles.summaryLabel}>TOTAL SALES</Text>
                    <Text style={styles.summaryValueSales}>Rs {summaries.totalSales.toLocaleString()}</Text>
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
                {summaries.paymentAnalysis.map((item, index) => (
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
                    <Text style={[styles.totalLabel, { textAlign: 'right' }]}>Rs {summaries.totalSales.toLocaleString()}</Text>
                    <Text style={[styles.totalLabel, { textAlign: 'right', color: Colors.primary }]}>Rs {summaries.totalPurchase.toLocaleString()}</Text>
                </View>
            </View>

            {/* Supplier Breakdown */}
            <View style={styles.card}>
                <SectionHeader title="Supplier Breakdown" icon={Users} />
                <View style={styles.divider} />
                {summaries.supplierBreakdown.length > 0 ? (
                    summaries.supplierBreakdown.map((item, index) => (
                        <View key={index}>
                            <View style={styles.supplierRow}>
                                <View style={styles.supplierInfo}>
                                    <Text style={styles.supplierDashboardName} numberOfLines={1}>{item.name}</Text>
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
                            {index < summaries.supplierBreakdown.length - 1 && <View style={styles.dividerDashed} />}
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyTextDashboard}>No supplier data</Text>
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
            {/* Custom Header */}
            <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitleText}>Transactions</Text>
                    <Text style={styles.headerSubtitleText}>{formatDate(parseISO(date), 'MMM dd, yyyy')}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {loading && purchases.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={purchases}
                    renderItem={renderTransactionItem}
                    keyExtractor={(item) => item.id}
                    ListHeaderComponent={Header}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={fetchDatePurchases} colors={[Colors.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <History size={48} color={Colors.border} />
                            <Text style={styles.emptyText}>No transactions found for this date.</Text>
                        </View>
                    }
                />
            )}

            <PurchaseDetailModal
                visible={detailVisible}
                purchase={selectedPurchase}
                onClose={() => {
                    setDetailVisible(false);
                    setSelectedPurchase(null);
                }}
                onEdit={(p) => {
                    setDetailVisible(false);
                    setSelectedPurchase(p);
                    setModalVisible(true);
                }}
            />

            <AddPurchaseModal
                visible={modalVisible}
                onClose={() => {
                    setModalVisible(false);
                    setSelectedPurchase(null);
                    fetchDatePurchases();
                }}
                editPurchase={selectedPurchase}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    backButton: {
        padding: 8,
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerTitleText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    headerSubtitleText: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    dashboardContainer: {
        backgroundColor: '#FFFFFF',
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
        borderColor: '#2D3748',
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
    supplierDashboardName: {
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
    listContainer: {
        paddingBottom: Spacing.xl,
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
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
    emptyTextDashboard: {
        fontSize: 14,
        color: '#A0AEC0',
        textAlign: 'center',
        padding: 20,
    },
});
