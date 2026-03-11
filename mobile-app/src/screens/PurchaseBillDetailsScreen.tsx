import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    FlatList,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Search, FileText, BarChart3, Filter } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { PanVatRepo, PanVatBill, PurchaseBillingReportItem } from '../db/panVatRepo';

type TabType = 'pan-vat-bill' | 'report';

export default function PurchaseBillDetailsScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<TabType>('pan-vat-bill');
    const [bills, setBills] = useState<PanVatBill[]>([]);
    const [reports, setReports] = useState<PurchaseBillingReportItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            await PanVatRepo.syncWithRemote(); // Optional sync on load
            const billData = await PanVatRepo.getAll();
            const reportData = await PanVatRepo.getReport();
            setBills(billData);
            setReports(reportData);
        } catch (error) {
            console.error('[PurchaseBillDetails] Load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredBills = bills.filter(bill =>
        bill.invoice_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.supplier_company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.buyer_company_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderBillItem = ({ item, index }: { item: PanVatBill, index: number }) => (
        <View style={styles.billCard}>
            <View style={styles.billHeader}>
                <Text style={styles.snText}>{index + 1}</Text>
                <Text style={styles.invoiceText}>{item.invoice_no}</Text>
                <Text style={styles.dateText}>{item.issue_bill_date_bs}</Text>
            </View>
            <View style={styles.companyRow}>
                <View style={styles.companyCol}>
                    <Text style={styles.colLabel}>Supplier</Text>
                    <Text style={styles.colValue} numberOfLines={1}>{item.supplier_company_name || '-'}</Text>
                </View>
                <View style={styles.companyCol}>
                    <Text style={styles.colLabel}>Buyer</Text>
                    <Text style={styles.colValue} numberOfLines={1}>{item.buyer_company_name || '-'}</Text>
                </View>
            </View>
            <View style={styles.billFooter}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>Rs. {(item.total_amount || 0).toLocaleString()}</Text>
            </View>
        </View>
    );

    const renderReportItem = ({ item, index }: { item: PurchaseBillingReportItem, index: number }) => (
        <View style={styles.billCard}>
            <View style={styles.billHeader}>
                <Text style={styles.snText}>{index + 1}</Text>
                <Text style={styles.invoiceText} numberOfLines={1}>{item.supplier_company_name}</Text>
                <View style={styles.countBadge}>
                    <Text style={styles.countText}>{item.bill_count} Bills</Text>
                </View>
            </View>
            <View style={styles.companyRow}>
                <Text style={styles.colLabel}>Billed To: </Text>
                <Text style={styles.colValue} numberOfLines={1}>{item.buyer_company_name}</Text>
            </View>
            <View style={styles.billFooter}>
                <Text style={styles.totalLabel}>Total Billed Amount</Text>
                <Text style={[styles.totalValue, { color: Colors.primary }]}>
                    Rs. {(item.total_bill_amount || 0).toLocaleString()}
                </Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Purchase Bill Details</Text>
                <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
                    <Filter size={20} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {activeTab === 'pan-vat-bill' && (
                    <View style={styles.searchContainer}>
                        <Search size={18} color={Colors.textSecondary} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by supplier or invoice..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                )}

                {loading ? (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : activeTab === 'pan-vat-bill' ? (
                    <FlatList
                        data={filteredBills}
                        renderItem={renderBillItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No bills found</Text>
                            </View>
                        )}
                    />
                ) : (
                    <FlatList
                        data={reports}
                        renderItem={renderReportItem}
                        keyExtractor={(item, index) => `${item.supplier_company_id}-${item.buyer_company_id}-${index}`}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No report data found</Text>
                            </View>
                        )}
                        ListFooterComponent={() => (
                            reports.length > 0 ? (
                                <View style={styles.footerTotalCard}>
                                    <Text style={styles.footerTotalLabel}>Total Amount</Text>
                                    <Text style={styles.footerTotalValue}>
                                        Rs. {reports.reduce((sum, item) => sum + item.total_bill_amount, 0).toLocaleString()}
                                    </Text>
                                </View>
                            ) : null
                        )}
                    />
                )}
            </View>

            {/* Footer Navigation */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 15) }]}>
                <TouchableOpacity
                    style={[styles.footerTab, activeTab === 'pan-vat-bill' && styles.activeFooterTab]}
                    onPress={() => setActiveTab('pan-vat-bill')}
                >
                    <FileText size={20} color={activeTab === 'pan-vat-bill' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.footerTabText, activeTab === 'pan-vat-bill' && styles.activeFooterTabText]}>
                        Pan/Vat Bill
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.footerTab, activeTab === 'report' && styles.activeFooterTab]}
                    onPress={() => setActiveTab('report')}
                >
                    <BarChart3 size={20} color={activeTab === 'report' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.footerTabText, activeTab === 'report' && styles.activeFooterTabText]}>
                        Report
                    </Text>
                </TouchableOpacity>
            </View>
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
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
        textAlign: 'center',
    },
    refreshButton: {
        padding: 4,
    },
    content: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        margin: Spacing.md,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    searchIcon: {
        marginRight: Spacing.sm,
    },
    searchInput: {
        flex: 1,
        height: 40,
        fontSize: 14,
        color: Colors.text,
    },
    listContent: {
        padding: Spacing.md,
        paddingBottom: 80,
    },
    billCard: {
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    billHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        paddingBottom: Spacing.xs,
    },
    snText: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginRight: Spacing.sm,
    },
    invoiceText: {
        flex: 1,
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    dateText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    companyRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginVertical: Spacing.sm,
    },
    companyCol: {
        flex: 1,
    },
    colLabel: {
        fontSize: 10,
        color: Colors.textSecondary,
        marginBottom: 2,
    },
    colValue: {
        fontSize: 13,
        fontWeight: '500',
        color: Colors.text,
    },
    billFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.xs,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    totalLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    totalValue: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.text,
    },
    countBadge: {
        backgroundColor: Colors.primarySoft,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: Radius.round,
    },
    countText: {
        fontSize: 11,
        color: Colors.primary,
        fontWeight: 'bold',
    },
    footerTotalCard: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        alignItems: 'center',
        marginTop: Spacing.md,
    },
    footerTotalLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    footerTotalValue: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 4,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
    footer: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingTop: 10,
        paddingHorizontal: Spacing.sm,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    footerTab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: Radius.md,
        marginHorizontal: Spacing.xs,
    },
    activeFooterTab: {
        backgroundColor: Colors.primarySoft || 'rgba(59, 130, 246, 0.1)',
    },
    footerTabText: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    activeFooterTabText: {
        color: Colors.primary,
        fontWeight: 'bold',
    },
});
