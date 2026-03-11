import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SupplierRepo } from '../db/supplierRepo';
import { useDataStore } from '../store/useDataStore';

export default function SupplierLedgerScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { supplierId, supplierName } = route.params || {};

    const [ledgerData, setLedgerData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { syncPurchasingData } = useDataStore();

    useEffect(() => {
        loadLedger();
    }, [supplierId]);

    const loadLedger = async () => {
        try {
            const data = await SupplierRepo.getSupplierLedgerDetails(supplierId);
            setLedgerData(data);
        } catch (error) {
            console.error('Failed to load ledger:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            // First sync from Supabase
            await syncPurchasingData();
            // Then reload local view
            await loadLedger();
        } catch (error) {
            console.error('Refresh failed:', error);
            setRefreshing(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return `रु ${amount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>{supplierName || 'Supplier Ledger'}</Text>
                    <Text style={styles.headerSubtitle}>Complete Transaction History</Text>
                </View>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading ledger...</Text>
                </View>
            ) : ledgerData.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No transactions found</Text>
                </View>
            ) : (
                <ScrollView style={styles.scrollView} horizontal>
                    <View>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <View style={[styles.tableCell, styles.dateColumn]}>
                                <Text style={styles.headerText}>Date</Text>
                            </View>
                            <View style={[styles.tableCell, styles.particularColumn]}>
                                <Text style={styles.headerText}>Particular</Text>
                            </View>
                            <View style={[styles.tableCell, styles.amountColumn]}>
                                <Text style={[styles.headerText, styles.alignRight]}>Debit</Text>
                            </View>
                            <View style={[styles.tableCell, styles.amountColumn]}>
                                <Text style={[styles.headerText, styles.alignRight]}>Credit</Text>
                            </View>
                            <View style={[styles.tableCell, styles.amountColumn]}>
                                <Text style={[styles.headerText, styles.alignRight]}>Running Amount</Text>
                            </View>
                        </View>

                        {/* Table Rows */}
                        <ScrollView
                            style={styles.tableBody}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={handleRefresh}
                                    colors={[Colors.primary]}
                                    tintColor={Colors.primary}
                                />
                            }
                        >
                            {ledgerData.map((entry, index) => (
                                <View
                                    key={entry.id}
                                    style={[
                                        styles.tableRow,
                                        index % 2 === 0 ? styles.evenRow : styles.oddRow
                                    ]}
                                >
                                    <View style={[styles.tableCell, styles.dateColumn]}>
                                        <Text style={styles.cellText}>{formatDate(entry.date)}</Text>
                                    </View>
                                    <View style={[styles.tableCell, styles.particularColumn]}>
                                        <Text style={styles.cellTextBold}>{entry.particular}</Text>
                                        {entry.particular_detail && (
                                            <Text style={styles.cellTextSmall}>{entry.particular_detail}</Text>
                                        )}
                                    </View>
                                    <View style={[styles.tableCell, styles.amountColumn]}>
                                        <Text style={[styles.cellText, styles.alignRight, styles.debitText]}>
                                            {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                                        </Text>
                                    </View>
                                    <View style={[styles.tableCell, styles.amountColumn]}>
                                        <Text style={[styles.cellText, styles.alignRight, styles.creditText]}>
                                            {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                                        </Text>
                                    </View>
                                    <View style={[styles.tableCell, styles.amountColumn]}>
                                        <Text
                                            style={[
                                                styles.cellTextBold,
                                                styles.alignRight,
                                                entry.running_amount > 1
                                                    ? styles.negativeBalance
                                                    : entry.running_amount < -1
                                                        ? styles.positiveBalance
                                                        : styles.neutralBalance
                                            ]}
                                        >
                                            {formatCurrency(entry.running_amount)}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
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
        padding: Spacing.xs,
        marginRight: Spacing.sm,
    },
    headerTextContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    headerSubtitle: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: Spacing.md,
        fontSize: 14,
        color: Colors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    scrollView: {
        flex: 1,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: Colors.primary,
        borderBottomWidth: 2,
        borderBottomColor: Colors.border,
    },
    tableBody: {
        flex: 1,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    evenRow: {
        backgroundColor: Colors.card,
    },
    oddRow: {
        backgroundColor: Colors.background,
    },
    tableCell: {
        padding: Spacing.sm,
        justifyContent: 'center',
    },
    dateColumn: {
        width: 100,
    },
    particularColumn: {
        width: 200,
    },
    amountColumn: {
        width: 120,
    },
    headerText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.card,
        textTransform: 'uppercase',
    },
    cellText: {
        fontSize: 13,
        color: Colors.text,
    },
    cellTextBold: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.text,
    },
    cellTextSmall: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    alignRight: {
        textAlign: 'right',
    },
    debitText: {
        color: '#DC2626', // Red for debit
    },
    creditText: {
        color: '#16A34A', // Green for credit
    },
    negativeBalance: {
        color: '#DC2626', // Red - supplier owes us
    },
    positiveBalance: {
        color: '#16A34A', // Green - we owe supplier
    },
    neutralBalance: {
        color: Colors.text,
    },
});
