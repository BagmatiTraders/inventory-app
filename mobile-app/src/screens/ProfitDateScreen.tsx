import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator, FlatList, RefreshControl, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { DarazRepo } from '../db/darazRepo';
import { format } from 'date-fns';
import { ChevronRight, X, Calendar, Store, TrendingUp, TrendingDown } from 'lucide-react-native';

export default function ProfitDateScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [dateStats, setDateStats] = useState<any>({});
    const [sortedDates, setSortedDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        fetchStats();
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

    const fetchStats = async () => {
        try {
            setLoading(true);
            const data = await DarazRepo.getProfitTrackerCompleteDateStats({});
            setDateStats(data);
            setSortedDates(Object.keys(data).sort((a, b) => b.localeCompare(a)));
        } catch (error) {
            console.error('Error fetching date stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const data = await DarazRepo.getProfitTrackerCompleteDateStats({});
            setDateStats(data);
            setSortedDates(Object.keys(data).sort((a, b) => b.localeCompare(a)));
        } catch (error) {
            console.error('Error refreshing date stats:', error);
        } finally {
            setRefreshing(false);
        }
    }, []);

    const handleDatePress = (date: string) => {
        setSelectedDate(date);
        setModalVisible(true);
    };

    const renderDateItem = ({ item, index }: { item: string; index: number }) => {
        const stats = dateStats[item];
        const profit = stats.totalProfit || 0;

        return (
            <TouchableOpacity
                style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}
                onPress={() => handleDatePress(item)}
            >
                <View style={[styles.cell, { flex: 1 }]}>
                    <Text style={styles.dateText}>{format(new Date(item), 'yyyy-MM-dd')}</Text>
                    <Text style={styles.dayText}>{format(new Date(item), 'EEEE')}</Text>
                </View>
                <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
                    <View style={styles.profitContainer}>
                        {profit >= 0 ? <TrendingUp size={14} color={Colors.success} /> : <TrendingDown size={14} color={Colors.danger} />}
                        <Text style={[styles.profitText, profit >= 0 ? styles.profitPositive : styles.profitNegative]}>
                            Rs. {Math.round(profit).toLocaleString()}
                        </Text>
                    </View>
                    <Text style={styles.revenueText}>Rev: Rs. {Math.round(stats.totalRevenue || 0).toLocaleString()}</Text>
                </View>
                <View style={{ width: Spacing.sm }} />
                <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={[]}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={[styles.headerCell, { flex: 1 }]}>
                        <Text style={styles.headerText}>Date</Text>
                    </View>
                    <View style={[styles.headerCell, { flex: 1, alignItems: 'flex-end' }]}>
                        <Text style={styles.headerText}>Total Profit</Text>
                    </View>
                    <View style={{ width: 18 + Spacing.sm }} />
                </View>

                {loading && !refreshing ? (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={sortedDates}
                        renderItem={renderDateItem}
                        keyExtractor={(item) => item}
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

            {/* Date Drill-down Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Daily Breakdown</Text>
                                {selectedDate && (
                                    <View style={styles.modalSubHeader}>
                                        <Calendar size={14} color={Colors.textSecondary} />
                                        <Text style={styles.modalDate}>{format(new Date(selectedDate), 'MMMM dd, yyyy')}</Text>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        {selectedDate && dateStats[selectedDate] && (
                            <>
                                <ScrollView style={styles.modalScroll}>
                                    <View style={styles.modalInnerPadding}>
                                        <View style={styles.summaryCard}>
                                            <View style={styles.summaryItem}>
                                                <Text style={styles.summaryLabel}>Daily Profit</Text>
                                                <Text style={[styles.summaryValue, dateStats[selectedDate].totalProfit >= 0 ? styles.profitPositive : styles.profitNegative]}>
                                                    Rs. {Math.round(dateStats[selectedDate].totalProfit).toLocaleString()}
                                                </Text>
                                            </View>
                                            <View style={styles.summaryDivider} />
                                            <View style={styles.summaryItem}>
                                                <Text style={styles.summaryLabel}>Daily Revenue</Text>
                                                <Text style={styles.summaryValue}>
                                                    Rs. {Math.round(dateStats[selectedDate].totalRevenue).toLocaleString()}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text style={styles.sectionTitle}>Breakdown by Store</Text>
                                        {Object.entries(dateStats[selectedDate].statsBySeller).map(([seller, stats]: [string, any], idx) => (
                                            <View key={idx} style={styles.sellerCard}>
                                                <View style={styles.sellerHeader}>
                                                    <View style={styles.sellerNameRow}>
                                                        <Store size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                                                        <Text style={styles.sellerName}>{seller}</Text>
                                                    </View>
                                                    <Text style={[styles.sellerProfit, stats.profit >= 0 ? styles.profitPositive : styles.profitNegative]}>
                                                        Rs. {Math.round(stats.profit).toLocaleString()}
                                                    </Text>
                                                </View>
                                                <View style={styles.sellerDetails}>
                                                    <View style={styles.sellerDetailItem}>
                                                        <Text style={styles.sellerDetailLabel}>Revenue</Text>
                                                        <Text style={styles.sellerDetailValue}>Rs. {Math.round(stats.revenue || 0).toLocaleString()}</Text>
                                                    </View>
                                                    <View style={styles.sellerDetailItem}>
                                                        <Text style={styles.sellerDetailLabel}>Cost</Text>
                                                        <Text style={styles.sellerDetailValue}>Rs. {Math.round(stats.cost || 0).toLocaleString()}</Text>
                                                    </View>
                                                    {stats.missing > 0 && (
                                                        <View style={styles.sellerDetailItem}>
                                                            <Text style={[styles.sellerDetailLabel, { color: Colors.warning }]}>Unsynced Orders</Text>
                                                            <Text style={[styles.sellerDetailValue, { color: Colors.warning }]}>{stats.missing}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                                <View style={styles.modalFooter}>
                                    <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                                        <Text style={styles.closeButtonText}>Close Breakdown</Text>
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
        fontSize: 15,
        color: Colors.text,
        fontWeight: '600',
    },
    dayText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    profitContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profitText: {
        fontSize: 15,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    profitPositive: {
        color: Colors.success,
    },
    profitNegative: {
        color: Colors.danger,
    },
    revenueText: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginTop: 2,
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
    modalSubHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    modalDate: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginLeft: 4,
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
    closeButton: {
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
        borderRadius: Radius.md,
    },
    closeButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    summaryCard: {
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        flexDirection: 'row',
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        backgroundColor: Colors.border,
        marginHorizontal: Spacing.md,
    },
    summaryLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: Spacing.md,
    },
    sellerCard: {
        backgroundColor: Colors.card,
        borderRadius: Radius.md,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    sellerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    sellerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sellerName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.text,
    },
    sellerProfit: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    sellerDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingTop: Spacing.sm,
    },
    sellerDetailItem: {
        width: '50%',
        marginBottom: 4,
    },
    sellerDetailLabel: {
        fontSize: 11,
        color: Colors.textSecondary,
    },
    sellerDetailValue: {
        fontSize: 13,
        color: Colors.text,
        fontWeight: '500',
    },
});
