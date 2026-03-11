import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Plus, Receipt, Edit2, Trash2, Calendar, DollarSign, ChevronLeft } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { ExpenseRepo, type Expense } from '../db/expenseRepo';
import AddExpenseModal from './AddExpenseModal';
import { supabase } from '../lib/supabase';

export default function ExpenseScreen() {
    const navigation = useNavigation();
    const [activeTab, setActiveTab] = useState<'expenses' | 'reports'>('expenses');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [reportData, setReportData] = useState<{ date: string; count: number; total: number }[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | undefined>();
    const [userId, setUserId] = useState<string>('');
    const [userRole, setUserRole] = useState<string>('');

    // Get user session
    useEffect(() => {
        async function getUserSession() {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id);

                // Get user role
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                if (profile) {
                    setUserRole(profile.role);
                }
            }
        }
        getUserSession();
    }, []);

    const loadData = async () => {
        if (!userId) return;

        setLoading(true);
        try {
            await ExpenseRepo.syncWithRemote(userId, userRole);
            const expensesData = await ExpenseRepo.getAll(userId, userRole);
            const reportData = await ExpenseRepo.getDateWiseReport(userId, userRole);
            setExpenses(expensesData);
            setReportData(reportData);
        } catch (error) {
            console.error('Failed to load expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [userId, userRole])
    );

    const handleEdit = (expense: Expense) => {
        const editStatus = ExpenseRepo.canEdit(expense);
        if (!editStatus.canEdit) {
            Alert.alert('Cannot Edit', editStatus.reason || 'This expense cannot be edited');
            return;
        }
        setEditingExpense(expense);
        setModalVisible(true);
    };

    const handleDelete = async (id: string) => {
        Alert.alert(
            'Delete Expense',
            'Are you sure you want to delete this expense?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await ExpenseRepo.delete(id);
                            await loadData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete expense');
                        }
                    },
                },
            ]
        );
    };

    const renderExpenseCard = ({ item }: { item: Expense }) => {
        const canEdit = ExpenseRepo.canEdit(item);

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) }]}>
                        <Text style={styles.categoryBadgeText}>{item.category}</Text>
                    </View>
                    <Text style={styles.cardDate}>
                        {new Date(item.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </Text>
                </View>

                <View style={styles.cardBody}>
                    <Text style={styles.itemName}>{item.expense_item}</Text>
                    <View style={styles.amountRow}>
                        <Text style={styles.amount}>NPR {item.amount.toLocaleString()}</Text>
                        <TouchableOpacity
                            style={[styles.actionButton, !canEdit.canEdit && styles.actionButtonDisabled]}
                            onPress={() => handleEdit(item)}
                            disabled={!canEdit.canEdit}
                        >
                            <Edit2 size={18} color={canEdit.canEdit ? Colors.primary : Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {item.remarks && (
                    <Text style={styles.remarks}>{item.remarks}</Text>
                )}
            </View>
        );
    };

    const renderReportRow = ({ item }: { item: { date: string; count: number; total: number } }) => (
        <View style={styles.reportRow}>
            <View style={styles.reportCell}>
                <Text style={styles.reportDate}>
                    {new Date(item.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    })}
                </Text>
            </View>
            <View style={styles.reportCell}>
                <Text style={styles.reportCount}>{item.count}</Text>
            </View>
            <View style={styles.reportCell}>
                <Text style={styles.reportTotal}>NPR {item.total.toLocaleString()}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Expenses</Text>
                <View style={styles.headerRight} />
            </View>

            <View style={styles.container}>
                {/* Tab Navigation */}
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'expenses' && styles.tabActive]}
                        onPress={() => setActiveTab('expenses')}
                    >
                        <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>
                            Expenses
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'reports' && styles.tabActive]}
                        onPress={() => setActiveTab('reports')}
                    >
                        <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>
                            Reports
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {loading && !refreshing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : activeTab === 'expenses' ? (
                    <FlatList
                        data={expenses}
                        renderItem={renderExpenseCard}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Receipt size={64} color={Colors.textSecondary} />
                                <Text style={styles.emptyText}>No expenses yet</Text>
                            </View>
                        }
                    />
                ) : (
                    <ScrollView
                        style={styles.reportContainer}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                        }
                    >
                        <View style={styles.reportTable}>
                            <View style={styles.reportHeader}>
                                <View style={styles.reportCell}>
                                    <Text style={styles.reportHeaderText}>Date</Text>
                                </View>
                                <View style={styles.reportCell}>
                                    <Text style={styles.reportHeaderText}># Expenses</Text>
                                </View>
                                <View style={styles.reportCell}>
                                    <Text style={styles.reportHeaderText}>Total Amount</Text>
                                </View>
                            </View>
                            {reportData.map((item, index) => (
                                <View key={index}>
                                    {renderReportRow({ item })}
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                )}

                {/* Floating Action Button */}
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => {
                        setEditingExpense(undefined);
                        setModalVisible(true);
                    }}
                >
                    <Plus size={24} color="#FFF" />
                </TouchableOpacity>

                {/* Add/Edit Modal */}
                <AddExpenseModal
                    visible={modalVisible}
                    onClose={() => {
                        setModalVisible(false);
                        setEditingExpense(undefined);
                    }}
                    expense={editingExpense}
                    userId={userId}
                    onSuccess={loadData}
                />
            </View>
        </SafeAreaView>
    );
}

function getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
        'Vehicle Expenses': '#FF6B6B',
        'Office Expenses': '#4ECDC4',
        'Rent': '#95E1D3',
        'Personal Expenses': '#F9CA24',
        'Others': '#A8DADC',
    };
    return colors[category] || '#95A5A6';
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 4,
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
    tabBar: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    tab: {
        flex: 1,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: Colors.danger,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    tabTextActive: {
        color: Colors.danger,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: Spacing.md,
        paddingBottom: 80,
    },
    card: {
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    categoryBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: Radius.md,
    },
    categoryBadgeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    cardDate: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    cardBody: {
        marginBottom: Spacing.sm,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 4,
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    amount: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.danger,
    },
    remarks: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontStyle: 'italic',
        marginTop: 4,
    },
    actionButton: {
        padding: 8,
        borderRadius: Radius.md,
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyText: {
        marginTop: Spacing.md,
        fontSize: 16,
        color: Colors.textSecondary,
    },
    reportContainer: {
        flex: 1,
    },
    reportTable: {
        margin: Spacing.md,
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        overflow: 'hidden',
    },
    reportHeader: {
        flexDirection: 'row',
        backgroundColor: '#F8F9FA',
        borderBottomWidth: 2,
        borderBottomColor: Colors.border,
    },
    reportRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    reportCell: {
        flex: 1,
        padding: Spacing.md,
        alignItems: 'center',
    },
    reportHeaderText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.text,
    },
    reportDate: {
        fontSize: 14,
        color: Colors.text,
    },
    reportCount: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '600',
    },
    reportTotal: {
        fontSize: 14,
        color: Colors.danger,
        fontWeight: 'bold',
    },
    fab: {
        position: 'absolute',
        bottom: 90,
        right: Spacing.lg,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.danger,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
});
