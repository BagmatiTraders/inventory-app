import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useDataStore } from '../store/useDataStore';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { Package, Hash, ExternalLink, ArrowDown, ArrowUp } from 'lucide-react-native';

export default function AutoAdjustmentScreen() {
    const { autoAdjustments, fetchAutoAdjustments, isLoading } = useDataStore();

    useEffect(() => {
        fetchAutoAdjustments();
    }, []);

    const getStatusColor = (status: string) => {
        const s = status.toLowerCase();
        if (['delivered', 'completed'].includes(s)) return '#10b981';
        if (['shipped'].includes(s)) return '#3b82f6';
        if (['pending'].includes(s)) return '#f59e0b';
        if (['returned', 'fail delivered'].includes(s)) return '#ef4444';
        return Colors.textSecondary;
    };

    const renderAdjustmentItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.comboName}>{item.combo_product_name}</Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
                        <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                            <Text style={[styles.badgeText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
                        </View>
                    </View>
                </View>
                <View style={[styles.sourceBadge, { backgroundColor: item.source === 'Daraz' ? '#f9731620' : '#3b82f620' }]}>
                    <Text style={[styles.sourceText, { color: item.source === 'Daraz' ? '#f97316' : '#3b82f6' }]}>{item.source}</Text>
                </View>
            </View>

            <View style={styles.componentsList}>
                <Text style={styles.componentsTitle}>Stock Effects:</Text>
                {item.components.map((comp: any, index: number) => (
                    <View key={index} style={styles.componentItem}>
                        <View style={styles.componentInfo}>
                            <Package size={14} color={Colors.textSecondary} />
                            <Text style={styles.componentName}>{comp.name}</Text>
                        </View>
                        <View style={styles.qtyContainer}>
                            <Text style={styles.qtyLabel}>Qty: {comp.qty_display}</Text>
                            <View style={[
                                styles.stockEffectBadge,
                                { backgroundColor: comp.stock_effect === 'negative' ? '#fee2e2' : comp.stock_effect === 'positive' ? '#d1fae5' : '#f3f4f6' }
                            ]}>
                                {comp.stock_effect === 'negative' ? <ArrowDown size={12} color="#ef4444" /> : comp.stock_effect === 'positive' ? <ArrowUp size={12} color="#10b981" /> : null}
                                <Text style={[
                                    styles.stockEffectText,
                                    { color: comp.stock_effect === 'negative' ? '#ef4444' : comp.stock_effect === 'positive' ? '#10b981' : Colors.textSecondary }
                                ]}>
                                    {comp.stock_display}
                                </Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={autoAdjustments}
                renderItem={renderAdjustmentItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={fetchAutoAdjustments} />
                }
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={styles.emptyContainer}>
                            <Package size={48} color={Colors.border} />
                            <Text style={styles.emptyText}>No auto adjustments found</Text>
                        </View>
                    ) : null
                }
                ListHeaderComponent={
                    <View style={styles.header}>
                        <Text style={styles.title}>History</Text>
                        <Text style={styles.subtitle}>Last 50 auto-adjustments for combo products</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    list: {
        padding: Spacing.md,
    },
    header: {
        marginBottom: Spacing.md,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    card: {
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        paddingBottom: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    comboName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: Spacing.sm,
    },
    date: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: Radius.round,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    sourceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Radius.md,
    },
    sourceText: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    componentsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    componentsList: {
        gap: Spacing.xs,
    },
    componentItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    componentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    componentName: {
        fontSize: 14,
        color: Colors.text,
    },
    qtyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    qtyLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    stockEffectBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 2,
        minWidth: 40,
        justifyContent: 'center',
    },
    stockEffectText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginTop: 40,
    },
    emptyText: {
        color: Colors.textSecondary,
        marginTop: Spacing.md,
        fontSize: 16,
    },
});
