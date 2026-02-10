import React, { useState, useEffect } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, Repeat, Users, Loader2 } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { SupplierRepo, SupplierLedgerEntry } from '../db/supplierRepo';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';

export default function TransactionsScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [search, setSearch] = useState('');
    const [suppliers, setSuppliers] = useState<SupplierLedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchSuppliers = async () => {
        try {
            const data = await SupplierRepo.getSupplierLedger(search);
            setSuppliers(data);
        } catch (error) {
            console.error('Failed to fetch suppliers:', error);
            Alert.alert('Error', 'Failed to load supplier records.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, [search]);

    const handlePress = (supplier: SupplierLedgerEntry) => {
        navigation.navigate('SupplierDetail', {
            supplierId: supplier.supplier_id,
            supplierName: supplier.supplier_name
        });
    };

    const getBalanceColor = (balance: number) => {
        if (balance > 1) return Colors.danger; // Red for money owed (Credit > Debit)
        if (balance < -1) return Colors.success; // Green for surplus (Debit > Credit)
        return Colors.text;
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={[]}>
            <View style={styles.searchContainer}>
                <Search size={20} color={Colors.textSecondary} style={styles.searchIcon} />
                <TextInput
                    placeholder="Search Suppliers..."
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor={Colors.textSecondary}
                    style={styles.searchInput}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <X size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <Loader2 size={32} color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading accounts...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.container}
                    contentContainerStyle={suppliers.length === 0 ? styles.emptyScroll : null}
                >
                    {suppliers.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Users size={48} color={Colors.border} />
                            <Text style={styles.emptyText}>No suppliers found</Text>
                        </View>
                    ) : (
                        suppliers.map((supplier) => (
                            <TouchableOpacity
                                key={supplier.supplier_id}
                                style={styles.supplierCard}
                                onPress={() => handlePress(supplier)}
                            >
                                <Text style={styles.supplierName} numberOfLines={1}>{supplier.supplier_name}</Text>
                                <View style={styles.amountContainer}>
                                    <Text style={[styles.amountValue, { color: getBalanceColor(supplier.running_balance) }]}>
                                        रु {Math.abs(supplier.running_balance).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: Spacing.sm,
        color: Colors.textSecondary,
        fontSize: 14,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        margin: Spacing.md,
        paddingHorizontal: Spacing.md,
        height: 48,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    searchIcon: {
        marginRight: Spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: Colors.text,
    },
    container: {
        flex: 1,
    },
    emptyScroll: {
        flex: 1,
        justifyContent: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 100,
    },
    emptyText: {
        marginTop: Spacing.md,
        color: Colors.textSecondary,
        fontSize: 16,
    },
    supplierCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    supplierName: {
        flex: 1,
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
        marginRight: Spacing.md,
    },
    amountContainer: {
        alignItems: 'flex-end',
    },
    amountValue: {
        fontSize: 15,
        fontWeight: 'bold',
    },
});
