import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, BarChart2, Calendar, TrendingUp } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DarazRepo, DailySalesData } from '../db/darazRepo';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';

export default function DailySalesScreen() {
    const navigation = useNavigation();
    const [salesData, setSalesData] = useState<DailySalesData[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchReport = async () => {
        setLoading(true);
        const data = await DarazRepo.getDailySalesReport();
        setSalesData(data);
        setLoading(false);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        const data = await DarazRepo.getDailySalesReport();
        setSalesData(data);
        setRefreshing(false);
    };

    useEffect(() => {
        fetchReport();
    }, []);

    // Grouping by date for the display
    const groupedData = salesData.reduce((acc, item) => {
        if (!acc[item.date]) acc[item.date] = [];
        acc[item.date].push(item);
        return acc;
    }, {} as Record<string, DailySalesData[]>);

    const sortedDates = Object.keys(groupedData).sort((a, b) => b.localeCompare(a));

    const renderMetric = (label: string, value: string | number, color?: string) => (
        <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={[styles.metricValue, color ? { color } : {}]}>{value}</Text>
        </View>
    );

    const renderSellerCard = (item: DailySalesData) => (
        <View style={styles.card} key={`${item.date}-${item.seller_account}`}>
            <View style={styles.cardHeader}>
                <Text style={styles.sellerName}>{item.seller_account}</Text>
                <Text style={styles.totalAmount}>रु {item.shipped_amount.toLocaleString()}</Text>
            </View>

            <View style={styles.metricsGrid}>
                {renderMetric('Shipped', item.shipped_qty, Colors.primary)}
                {renderMetric('Delivered', item.delivered_qty, Colors.success)}
                {renderMetric('RTS', item.returning_to_seller_qty, Colors.warning)}
                {renderMetric('Ret. Del', item.returned_delivered_qty, Colors.orange)}
                {renderMetric('C. Return', item.return_qty, Colors.danger)}
                {renderMetric('CR. Del', item.customer_return_delivered_qty, Colors.danger)}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>

            {loading && !refreshing ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Fetching daily stats...</Text>
                </View>
            ) : (
                <FlatList
                    data={sortedDates}
                    keyExtractor={(date) => date}
                    renderItem={({ item: date }) => (
                        <View style={styles.dateSection}>
                            <View style={styles.dateHeader}>
                                <Calendar size={16} color={Colors.textSecondary} />
                                <Text style={styles.dateText}>
                                    {new Date(date).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </Text>
                            </View>
                            {groupedData[date].map(renderSellerCard)}
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No sales data found for the selected period.</Text>
                        </View>
                    }
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: Spacing.sm,
        color: Colors.textSecondary,
        fontSize: 14,
    },
    listContent: {
        paddingBottom: Spacing.xl,
    },
    dateSection: {
        marginTop: Spacing.md,
    },
    dateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.cardAlt,
        gap: Spacing.xs,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    backButton: {
        padding: 4,
    },
    dateText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.textSecondary,
    },
    card: {
        backgroundColor: Colors.card,
        marginHorizontal: Spacing.md,
        marginTop: Spacing.sm,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        paddingBottom: Spacing.xs,
    },
    sellerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    totalAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    metricItem: {
        width: '30%',
        marginBottom: Spacing.sm,
        alignItems: 'center',
    },
    metricLabel: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginBottom: 2,
    },
    metricValue: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.text,
    },
    emptyContainer: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.textSecondary,
        textAlign: 'center',
    },
});
