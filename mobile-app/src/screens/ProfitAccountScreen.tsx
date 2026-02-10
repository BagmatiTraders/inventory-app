import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { DarazRepo } from '../db/darazRepo';
import { format } from 'date-fns';
import { Store } from 'lucide-react-native';

export default function ProfitAccountScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<any[]>([]);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const dateStats = await DarazRepo.getProfitTrackerCompleteDateStats({});

            // Flatten the stats into a list for rendering
            const flattenedStats: any[] = [];

            // Sort dates descending
            const sortedDates = Object.keys(dateStats).sort((a, b) => b.localeCompare(a));

            sortedDates.forEach(date => {
                const dayData = dateStats[date];
                Object.entries(dayData.statsBySeller).forEach(([seller, sellerStats]: [string, any]) => {
                    flattenedStats.push({
                        date,
                        seller,
                        ...sellerStats
                    });
                });
            });

            setStats(flattenedStats);
        } catch (error) {
            console.error('Error fetching account stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const dateStats = await DarazRepo.getProfitTrackerCompleteDateStats({});
            const flattenedStats: any[] = [];
            const sortedDates = Object.keys(dateStats).sort((a, b) => b.localeCompare(a));
            sortedDates.forEach(date => {
                const dayData = dateStats[date];
                Object.entries(dayData.statsBySeller).forEach(([seller, sellerStats]: [string, any]) => {
                    flattenedStats.push({ date, seller, ...sellerStats });
                });
            });
            setStats(flattenedStats);
        } catch (error) {
            console.error('Error refreshing account stats:', error);
        } finally {
            setRefreshing(false);
        }
    }, []);

    const renderStatItem = ({ item, index }: { item: any; index: number }) => {
        return (
            <View style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
                <View style={[styles.cell, { flex: 1.2 }]}>
                    <Text style={styles.dateText}>{format(new Date(item.date), 'MMM-dd')}</Text>
                </View>
                <View style={[styles.cell, { flex: 2 }]}>
                    <View style={styles.sellerRow}>
                        <Store size={14} color={Colors.primary} style={{ marginRight: 4 }} />
                        <Text style={styles.sellerText} numberOfLines={1}>{item.seller}</Text>
                    </View>
                </View>
                <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
                    <Text style={[styles.profitText, (item.profit || 0) >= 0 ? styles.profitPositive : styles.profitNegative]}>
                        Rs. {Math.round(item.profit || 0).toLocaleString()}
                    </Text>
                    <Text style={styles.subText}>Profit</Text>
                </View>
                <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
                    <Text style={styles.totalText}>Rs. {Math.round(item.revenue || 0).toLocaleString()}</Text>
                    <Text style={styles.subText}>Total</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={[]}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={[styles.headerCell, { flex: 1.2 }]}>
                        <Text style={styles.headerText}>Date</Text>
                    </View>
                    <View style={[styles.headerCell, { flex: 2 }]}>
                        <Text style={styles.headerText}>Store / Account</Text>
                    </View>
                    <View style={[styles.headerCell, { flex: 1, alignItems: 'flex-end' }]}>
                        <Text style={styles.headerText}>Profit</Text>
                    </View>
                    <View style={[styles.headerCell, { flex: 1, alignItems: 'flex-end' }]}>
                        <Text style={styles.headerText}>Total</Text>
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={stats}
                        renderItem={renderStatItem}
                        keyExtractor={(item, idx) => `${item.date}-${item.seller}-${idx}`}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No data available.</Text>
                            </View>
                        }
                    />
                )}
            </View>
        </SafeAreaView>
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
        fontSize: 11,
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
        fontWeight: '500',
    },
    sellerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sellerText: {
        fontSize: 13,
        color: Colors.text,
        fontWeight: '600',
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
    totalText: {
        fontSize: 13,
        color: Colors.text,
        fontWeight: '500',
    },
    subText: {
        fontSize: 10,
        color: Colors.textSecondary,
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
});
