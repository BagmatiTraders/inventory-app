import React, { useState } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Calendar, List, PieChart, Plus, ListPlus, Users } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { useNavigation } from '@react-navigation/native';
import { useDataStore } from '../store/useDataStore';
import { ShortcutButton } from '../components/ShortcutButton';
import AddPurchaseModal from './AddPurchaseModal';
import AddPurchasePlanModal from '../components/AddPurchasePlanModal';

export default function PurchasingScreen() {
    const navigation = useNavigation<any>();
    const [isAddPurchaseVisible, setIsAddPurchaseVisible] = useState(false);
    const [isAddListVisible, setIsAddListVisible] = useState(false);

    const handlePress = (label: string) => {
        if (label === 'Daily Purchase List') {
            navigation.navigate('DailyPurchaseTabs');
        } else if (label === 'All Purchase List') {
            navigation.navigate('AllPurchaseTabs');
        } else if (label === 'Inventory Price Reports') {
            navigation.navigate('InventoryPriceReports');
        } else if (label === 'Add Purchase') {
            setIsAddPurchaseVisible(true);
        } else if (label === 'Add List') {
            setIsAddListVisible(true);
        } else if (label === 'Buy / Sell Suppliers') {
            Alert.alert('Coming Soon', 'Supplier management will be built later.');
        } else {
            Alert.alert('Coming Soon', `The ${label} feature is under development.`);
        }
    };

    const { purchasePlans, todayPurchases, isLoading, syncPurchasingData } = useDataStore();

    // Calculate Summary Stats
    const totalPlanQty = purchasePlans.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
    const totalTodayPurchaseQty = todayPurchases.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
    const totalPurchaseAmount = todayPurchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

    // Helper to check if a plan is already purchased (Consistent with List screen)
    const checkIsPurchased = (item: any) => {
        if (item.status === 'Pending') return false;
        return todayPurchases.some(p => {
            const pId = String(p.product_id || '').trim();
            const itemId = String(item.product_id || '').trim();
            const pName = (p.product?.product_name || p.purchase_name || '').trim().toLowerCase();
            const itemName = (item.product?.product_name || item.cached_product_name || '').trim().toLowerCase();

            const idMatch = pId && itemId && pId === itemId;
            const nameMatch = pName && itemName && pName === itemName;

            return idMatch || nameMatch;
        });
    };

    const pendingCount = purchasePlans.filter(p => p.status === 'Pending' && !checkIsPurchased(p)).length;
    const completeCount = purchasePlans.filter(p => (p.status === 'Complete' && !checkIsPurchased(p)) || checkIsPurchased(p)).length;
    const cancelCount = purchasePlans.filter(p => p.status === 'Cancel').length;

    const statusCards = [
        { label: 'Pending', value: pendingCount, color: Colors.warning, bgColor: Colors.warningSoft },
        { label: 'Complete', value: completeCount, color: Colors.success, bgColor: Colors.successSoft },
        { label: 'Cancel', value: cancelCount, color: Colors.danger, bgColor: Colors.dangerSoft },
    ];

    return (
        <SafeAreaView style={styles.safeArea} edges={[]}>
            <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={syncPurchasingData} />
                }
            >

                {/* 1. All Purchase List */}
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: Colors.primarySoft }]}
                    onPress={() => handlePress('All Purchase List')}
                >
                    <View style={styles.iconContainer}>
                        <List color={Colors.primary} />
                    </View>
                    <View style={styles.labelContainer}>
                        <Text style={styles.label}>All Purchase List</Text>
                    </View>
                    <ChevronRight size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                {/* 2. Inventory Price Reports */}
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: Colors.warningSoft }]}
                    onPress={() => handlePress('Inventory Price Reports')}
                >
                    <View style={styles.iconContainer}>
                        <PieChart color={Colors.warning} />
                    </View>
                    <View style={styles.labelContainer}>
                        <Text style={styles.label}>Inventory Price Reports</Text>
                    </View>
                    <ChevronRight size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                {/* 3. Daily Purchase List */}
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: Colors.successSoft }]}
                    onPress={() => handlePress('Daily Purchase List')}
                >
                    <View style={styles.iconContainer}>
                        <Calendar color={Colors.success} />
                    </View>
                    <View style={styles.labelContainer}>
                        <Text style={styles.label}>Daily Purchase List</Text>
                        <Text style={styles.qtyText}>Qty: {purchasePlans.length}</Text>
                    </View>
                    <ChevronRight size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                {/* 4. Status Summary Row */}
                <View style={styles.statusRow}>
                    {statusCards.map((card, index) => (
                        <View key={index} style={[styles.statusCard, { backgroundColor: card.bgColor }]}>
                            <Text style={[styles.statusValue, { color: card.color }]}>{card.value}</Text>
                            <Text style={styles.statusLabel}>{card.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Purchasing Summary */}
                <Text style={styles.sectionTitle}>Purchase Summary</Text>
                <View style={styles.summaryBox}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{totalTodayPurchaseQty}</Text>
                        <Text style={styles.summaryLabel}>Total Qty</Text>
                    </View>
                    <View style={[styles.summaryItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(59, 130, 246, 0.2)' }]}>
                        <Text style={styles.summaryValue}>रु {totalPurchaseAmount.toLocaleString()}</Text>
                        <Text style={styles.summaryLabel}>Total Amount</Text>
                    </View>
                </View>

                {/* 5. Shortcuts Grid */}
                <Text style={styles.sectionTitle}>Shortcuts</Text>
                <View style={styles.shortcutsGrid}>
                    <ShortcutButton
                        label="Add Purchase"
                        icon={<Plus size={24} color={Colors.primary} />}
                        onPress={() => handlePress('Add Purchase')}
                    />
                    <ShortcutButton
                        label="Add List"
                        icon={<ListPlus size={24} color={Colors.primary} />}
                        onPress={() => handlePress('Add List')}
                    />
                    <ShortcutButton
                        label="Buy / Sell Suppliers"
                        icon={<Users size={24} color={Colors.primary} />}
                        onPress={() => handlePress('Buy / Sell Suppliers')}
                    />
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            <AddPurchaseModal
                visible={isAddPurchaseVisible}
                onClose={() => setIsAddPurchaseVisible(false)}
            />

            <AddPurchasePlanModal
                visible={isAddListVisible}
                onClose={() => setIsAddListVisible(false)}
            />
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
        padding: Spacing.md,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.lg,
        gap: Spacing.sm,
    },
    statusCard: {
        flex: 1,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.card,
        // Elevation/Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    statusValue: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    statusLabel: {
        fontSize: 11,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        marginBottom: Spacing.md,
        backgroundColor: Colors.card,
        // Elevation/Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    iconContainer: {
        marginRight: Spacing.md,
    },
    labelContainer: {
        flex: 1,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    qtyText: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    summaryBox: {
        flexDirection: 'row',
        backgroundColor: Colors.primarySoft,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 5,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: 2,
    },
    summaryLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    shortcutsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 8,
        marginTop: Spacing.xs,
    },
});

