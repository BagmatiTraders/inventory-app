import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { DarazRepo, AccountSummary } from '../db/darazRepo';

export default function DarazSummaryScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [accountData, setAccountData] = useState<AccountSummary[]>([]);

    const fetchData = useCallback(async () => {
        try {
            const summaryData = await DarazRepo.getAccountSummary();
            setAccountData(summaryData);
        } catch (error) {
            console.error('Error fetching summary:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const StatusCell = ({ label, value, color = Colors.text }: { label: string, value: number, color?: string }) => (
        <View style={styles.cell}>
            <Text style={styles.cellLabel}>{label}</Text>
            <Text style={[styles.cellValue, { color }]}>{value}</Text>
        </View>
    );

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
            showsVerticalScrollIndicator={false}
        >
            <Text style={styles.headerTitle}>Order Status Sync Data</Text>

            {accountData.map((account, index) => (
                <View key={account.seller_account} style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.indexCircle}>
                            <Text style={styles.indexText}>{index + 1}</Text>
                        </View>
                        <View>
                            <Text style={styles.sellerName}>{account.company_name || account.seller_account}</Text>
                            <Text style={styles.sellerAccount}>{account.seller_account}</Text>
                        </View>
                    </View>

                    <View style={styles.gridContainer}>
                        <View style={styles.row}>
                            <StatusCell label="Pending" value={account.pending} color={Colors.warning} />
                            <StatusCell label="Packed" value={account.packed} color={Colors.info} />
                            <StatusCell label="RTS" value={account.ready_to_ship} color={Colors.primary} />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.row}>
                            <StatusCell label="Shipped" value={account.shipped} color={Colors.success} />
                            <StatusCell label="Delivered" value={account.delivered} color={Colors.success} />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.row}>
                            <StatusCell label="Ret to Seller" value={account.returning_to_seller} color={Colors.danger} />
                            <StatusCell label="Ret Delivered" value={account.returned_delivered} color={Colors.danger} />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.row}>
                            <StatusCell label="Cust Return" value={account.customer_return} color={Colors.danger} />
                            <StatusCell label="Cust Ret Del" value={account.customer_return_delivered} color={Colors.danger} />
                        </View>
                    </View>
                </View>
            ))}

            <View style={{ height: 20 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        padding: Spacing.md,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: Spacing.md,
        marginTop: Spacing.sm,
    },
    card: {
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        marginBottom: Spacing.md,
        padding: Spacing.md,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        paddingBottom: Spacing.sm,
    },
    indexCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    indexText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.textSecondary,
    },
    sellerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    sellerAccount: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    gridContainer: {
        gap: Spacing.sm,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'flex-start', // Align left for fixed width cells or space-around
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: 4,
    },
    cell: {
        flex: 1, // Distribute space
        alignItems: 'flex-start',
    },
    cellLabel: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    cellValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
});
