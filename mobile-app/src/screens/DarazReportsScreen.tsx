import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { DarazRepo, FiscalYear, SalesReport } from '../db/darazRepo';
import { StatCard } from '../components/StatCard';
import { DollarSign, Package } from 'lucide-react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface MonthlyDataItem {
    month: string;
    orderCount: number;
    totalAmount: number;
}

interface SellerDataItem {
    sellerAccount: string;
    companyName: string;
    orders: number;
    quantity: number;
    totalAmount: number;
}

interface DailyTrendItem {
    date: string;
    count: number;
}

export default function DarazReportsScreen() {
    const [loading, setLoading] = useState(true);
    const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('');
    const [monthlyData, setMonthlyData] = useState<MonthlyDataItem[]>([]);
    const [sellerData, setSellerData] = useState<SellerDataItem[]>([]);
    const [summary, setSummary] = useState<SalesReport | null>(null);
    const [dailyTrends, setDailyTrends] = useState<DailyTrendItem[]>([]);

    useEffect(() => {
        loadFiscalYears();
    }, []);

    const loadFiscalYears = async () => {
        const years = await DarazRepo.getFiscalYears();
        setFiscalYears(years);
        if (years.length > 0) {
            setSelectedFiscalYear(years[0].id);
        }
    };

    const fetchReportData = useCallback(async () => {
        if (!selectedFiscalYear) return;

        setLoading(true);
        try {
            const [monthly, sellers, total, trends] = await Promise.all([
                DarazRepo.getMonthlySalesByFiscalYear(selectedFiscalYear),
                DarazRepo.getSalesBySellerAccount(selectedFiscalYear),
                DarazRepo.getSalesByFiscalYear(selectedFiscalYear),
                DarazRepo.getDailyOrderTrends(7)
            ]);
            setMonthlyData(monthly as MonthlyDataItem[]);
            setSellerData(sellers as SellerDataItem[]);
            setSummary(total as SalesReport);
            setDailyTrends(trends as DailyTrendItem[]);
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedFiscalYear]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    const renderWeeklyChart = () => {
        if (dailyTrends.length === 0) return <Text style={styles.emptyText}>No data available</Text>;

        const maxVal = Math.max(...dailyTrends.map(d => d.count));

        return (
            <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>Daily Order Creation (Valid)</Text>
                <View style={styles.chartInner}>
                    {dailyTrends.map((item, index) => {
                        const height = maxVal > 0 ? (item.count / maxVal) * 150 : 0;
                        return (
                            <View key={index} style={styles.barGroup}>
                                <Text style={styles.barValue}>{item.count}</Text>
                                <View style={[styles.bar, { height: Math.max(height, 4), backgroundColor: Colors.info }]} />
                                <Text style={styles.barLabel}>{item.date.split('-').slice(1).join('/')}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* 1. Fiscal Year Dropdown */}
            <View style={styles.filterSection}>
                <Text style={styles.label}>Fiscal Year:</Text>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={selectedFiscalYear}
                        onValueChange={(itemValue) => setSelectedFiscalYear(itemValue)}
                        style={styles.picker}
                        dropdownIconColor={Colors.primary}
                    >
                        {fiscalYears.map((fy) => (
                            <Picker.Item key={fy.id} label={fy.name} value={fy.id} />
                        ))}
                    </Picker>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <>
                    {/* 2. Total Orders & Total Sales */}
                    <View style={styles.summaryGrid}>
                        <StatCard
                            title="Total Orders"
                            value={summary?.totalOrders || 0}
                            icon={Package}
                            color={Colors.primary}
                        />
                        <StatCard
                            title="Total Sales"
                            value={`Rs. ${((summary?.totalAmount || 0) / 1000).toFixed(1)}k`}
                            subValue={`Rs. ${(summary?.totalAmount || 0).toLocaleString()}`}
                            icon={DollarSign}
                            color={Colors.success}
                        />
                    </View>

                    {/* 3. Sales by Seller (Horizontal Scroll) */}
                    <Text style={styles.sectionTitle}>Sales by Seller</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {sellerData.map((seller, index) => (
                            <View key={index} style={styles.sellerCardHorizontal}>
                                <Text style={styles.sellerName} numberOfLines={1}>{seller.companyName}</Text>
                                <View style={styles.sellerStatsRow}>
                                    <View>
                                        <Text style={styles.sellerLabel}>Orders</Text>
                                        <Text style={styles.sellerValue}>{seller.orders}</Text>
                                    </View>
                                    <View style={styles.sellerDivider} />
                                    <View>
                                        <Text style={styles.sellerLabel}>Amount</Text>
                                        <Text style={[styles.sellerValue, { color: Colors.success }]}>
                                            {seller.totalAmount >= 1000
                                                ? `Rs. ${(seller.totalAmount / 1000).toFixed(1)}k`
                                                : seller.totalAmount}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    {/* 4. Monthly Progress (Vertical List) */}
                    <Text style={styles.sectionTitle}>Monthly Progress</Text>
                    <View style={styles.monthlyList}>
                        {[...monthlyData].reverse().map((item, index) => (
                            <View key={index} style={styles.monthlyItem}>
                                <View style={styles.monthBadge}>
                                    <Text style={styles.monthText}>{item.month}</Text>
                                </View>
                                <View style={styles.monthStats}>
                                    <View style={styles.monthStat}>
                                        <Text style={styles.monthLabel}>Orders</Text>
                                        <Text style={styles.monthValue}>{item.orderCount}</Text>
                                    </View>
                                    <View style={styles.monthStat}>
                                        <Text style={styles.monthLabel}>Amount</Text>
                                        <Text style={[styles.monthValue, { color: Colors.success }]}>
                                            Rs. {item.totalAmount.toLocaleString()}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* 5. Weekly Progress Chart */}
                    <Text style={styles.sectionTitle}>Weekly Progress</Text>
                    {renderWeeklyChart()}

                    <View style={{ height: 40 }} />
                </>
            )}
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
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
        marginRight: Spacing.sm,
    },
    pickerContainer: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.md,
        backgroundColor: Colors.card,
        height: 50,
        justifyContent: 'center',
    },
    picker: {
        width: '100%',
        height: 50,
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    chartContainer: {
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
        height: 220,
        justifyContent: 'center',
    },
    chartInner: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: Spacing.sm,
    },
    barGroup: {
        alignItems: 'center',
        marginRight: 16,
        width: 40,
    },
    bar: {
        width: 12,
        backgroundColor: Colors.primary,
        borderRadius: Radius.sm,
        marginTop: 4,
        marginBottom: 4,
    },
    barLabel: {
        fontSize: 10,
        color: Colors.textSecondary,
    },
    barValue: {
        fontSize: 10,
        color: Colors.text,
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        color: Colors.textSecondary,
        marginVertical: 20,
    },
    chartTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        marginBottom: Spacing.md,
        alignSelf: 'flex-start',
    },
    horizontalScroll: {
        marginBottom: Spacing.md,
    },
    sellerCardHorizontal: {
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginRight: Spacing.md,
        width: 160,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    sellerName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.text,
    },
    sellerStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.sm,
    },
    sellerLabel: {
        fontSize: 10,
        color: Colors.textSecondary,
    },
    sellerValue: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    sellerDivider: {
        width: 1,
        backgroundColor: Colors.border,
        marginHorizontal: 8,
    },
    monthlyList: {
        marginTop: Spacing.sm,
    },
    monthlyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: Spacing.md,
        borderRadius: Radius.md,
        marginBottom: Spacing.sm,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
        elevation: 1,
    },
    monthBadge: {
        backgroundColor: Colors.primarySoft,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: Radius.sm,
        marginRight: Spacing.md,
        width: 80,
        alignItems: 'center',
    },
    monthText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    monthStats: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    monthStat: {
        alignItems: 'flex-end',
    },
    monthLabel: {
        fontSize: 10,
        color: Colors.textSecondary,
    },
    monthValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.text,
    },
});
