import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Plus, FileText, DollarSign, ShoppingBag, Store, Truck } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { PanVatRepo } from '../db/panVatRepo';

export default function AccountBillingScreen() {
    const navigation = useNavigation<any>();
    const [purchaseSummary, setPurchaseSummary] = useState({ totalBill: 0, totalAmount: 0 });

    useEffect(() => {
        const loadSummary = async () => {
            const summary = await PanVatRepo.getSummary();
            setPurchaseSummary(summary);
        };
        loadSummary();
    }, []);

    const BillingSection = ({ title, type, summary, onHeaderPress }: {
        title: string,
        type: 'purchase' | 'sales',
        summary: { totalBill: number; totalAmount: number },
        onHeaderPress?: () => void
    }) => (
        <View style={styles.section}>
            <TouchableOpacity style={styles.fullWidthButton} onPress={onHeaderPress}>
                <View style={styles.buttonLeft}>
                    {type === 'purchase' ? <ShoppingBag size={20} color={Colors.primary} /> : <FileText size={20} color={Colors.success} />}
                    <Text style={styles.fullWidthButtonText}>{title}</Text>
                </View>
                <ChevronRight size={20} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.summaryCard}>
                <Text style={styles.summaryHeader}>Summary</Text>
                <View style={styles.cardsRow}>
                    <View style={styles.miniCard}>
                        <Text style={styles.miniCardValue}>{summary.totalBill}</Text>
                        <Text style={styles.miniCardLabel}>Total Bill</Text>
                    </View>
                    <View style={[styles.miniCard, { flex: 2 }]}>
                        <Text style={styles.miniCardValue}>Rs. {summary.totalAmount.toLocaleString()}</Text>
                        <Text style={styles.miniCardLabel}>Total Amount</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const NavigationButton = ({ label, icon }: { label: string, icon: React.ReactNode }) => (
        <TouchableOpacity style={styles.fullWidthButton}>
            <View style={styles.buttonLeft}>
                {icon}
                <Text style={styles.fullWidthButtonText}>{label}</Text>
            </View>
            <ChevronRight size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Account / Billing</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
                <BillingSection
                    title="Purchase Billing"
                    type="purchase"
                    summary={purchaseSummary}
                    onHeaderPress={() => navigation.navigate('PurchaseBillDetails')}
                />
                <BillingSection
                    title="Sales Billing"
                    type="sales"
                    summary={{ totalBill: 0, totalAmount: 0 }}
                />

                <View style={[styles.section, { marginTop: Spacing.md }]}>
                    <NavigationButton
                        label="E-Commerce Finance"
                        icon={<DollarSign size={20} color={Colors.primary} />}
                    />
                    <NavigationButton
                        label="Logistics Finance"
                        icon={<Truck size={20} color={Colors.orange || '#FD7E14'} />}
                    />
                    <NavigationButton
                        label="Retails Store Finance"
                        icon={<Store size={20} color={Colors.success} />}
                    />
                </View>
            </ScrollView>
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
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    backButton: {
        padding: 4,
        width: 40,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
        flex: 1,
        textAlign: 'center',
    },
    headerRight: {
        width: 40,
    },
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        padding: Spacing.md,
    },
    section: {
        marginBottom: Spacing.lg,
    },
    fullWidthButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.card,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.sm,
    },
    buttonLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    fullWidthButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    summaryCard: {
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    summaryHeader: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        marginBottom: Spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    cardsRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    miniCard: {
        flex: 1,
        backgroundColor: Colors.background,
        borderRadius: Radius.md,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    miniCardValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 2,
    },
    miniCardLabel: {
        fontSize: 10,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
});
