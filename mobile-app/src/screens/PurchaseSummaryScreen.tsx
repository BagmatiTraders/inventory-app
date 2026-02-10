import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { ChevronRight, ArrowRightLeft, TrendingUp, TrendingDown } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { PurchaseRepo } from '../db/purchaseRepo';
import { useNavigation } from '@react-navigation/native';
import { formatDate, parseISO } from '../utils/dateUtils';

export default function PurchaseSummaryScreen() {
    const navigation = useNavigation<any>();
    const [summaries, setSummaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSummaries = async () => {
        setLoading(true);
        try {
            const data = await PurchaseRepo.getDateWisePurchaseSummary();
            setSummaries(data);
        } catch (error) {
            console.error('Fetch summary error:', error);
            Alert.alert('Error', 'Failed to load purchase summary');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSummaries();
    }, []);

    const renderSummaryItem = ({ item }: { item: any }) => {
        const dateStr = formatDate(parseISO(item.date), 'MMM dd, yyyy');

        return (
            <TouchableOpacity
                style={styles.row}
                onPress={() => navigation.navigate('DateTransaction', { date: item.date })}
            >
                <View style={styles.dateCol}>
                    <Text style={styles.dateText}>{dateStr}</Text>
                </View>

                <View style={styles.amountCol}>
                    <View style={styles.amountBadge}>
                        <TrendingUp size={14} color={Colors.primary} />
                        <Text style={[styles.amountText, { color: Colors.primary }]}>
                            Rs. {item.sales_amount.toLocaleString()}
                        </Text>
                    </View>
                </View>

                <View style={styles.amountCol}>
                    <View style={styles.amountBadgePurchase}>
                        <TrendingDown size={14} color={Colors.success} />
                        <Text style={[styles.amountText, { color: Colors.success }]}>
                            Rs. {item.purchase_amount.toLocaleString()}
                        </Text>
                    </View>
                </View>

                <View style={styles.arrowCol}>
                    <ChevronRight size={20} color={Colors.textSecondary} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
                <Text style={[styles.headerText, styles.dateCol]}>Date</Text>
                <Text style={[styles.headerText, styles.amountCol]}>Sales Amt</Text>
                <Text style={[styles.headerText, styles.amountCol]}>Purchase Amt</Text>
                <View style={styles.arrowCol} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={summaries}
                    keyExtractor={(item) => item.date}
                    renderItem={renderSummaryItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <ArrowRightLeft size={48} color={Colors.border} />
                            <Text style={styles.emptyText}>No summaries available</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        alignItems: 'center',
    },
    headerText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        textTransform: 'uppercase',
    },
    row: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#F7FAFC',
        alignItems: 'center',
    },
    dateCol: {
        flex: 1.2,
    },
    amountCol: {
        flex: 2,
        alignItems: 'center',
    },
    arrowCol: {
        width: 30,
        alignItems: 'flex-end',
    },
    dateText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
    },
    amountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primarySoft,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Radius.round,
        gap: 4,
    },
    amountBadgePurchase: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.successSoft,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Radius.round,
        gap: 4,
    },
    amountText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    listContent: {
        paddingBottom: 20,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyText: {
        marginTop: Spacing.md,
        fontSize: 16,
        color: Colors.textSecondary,
    },
});
