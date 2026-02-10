import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Search, Calendar, X, Filter, ChevronRight, ShoppingCart } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { PurchaseRepo, Purchase } from '../db/purchaseRepo';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate } from '../utils/dateUtils';

const PAGE_SIZE = 50;

export default function AllPurchaseListScreen() {
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const fetchPurchases = useCallback(async (reset = false) => {
        if (loading || (loadingMore && !reset)) return;

        const newOffset = reset ? 0 : offset;
        if (reset) {
            setLoading(true);
            setPurchases([]);
        } else {
            setLoadingMore(true);
        }

        try {
            const filters = {
                productName: searchQuery,
                supplierName: searchQuery,
                startDate: startDate ? formatDate(startDate, 'yyyy-MM-dd') : undefined,
                endDate: endDate ? formatDate(endDate, 'yyyy-MM-dd') : undefined,
            };

            const data = await PurchaseRepo.getAllPurchasesPaginated(newOffset, PAGE_SIZE, filters);

            if (reset) {
                setPurchases(data);
            } else {
                setPurchases(prev => [...prev, ...data]);
            }

            setOffset(newOffset + PAGE_SIZE);
            setHasMore(data.length === PAGE_SIZE);
        } catch (error) {
            console.error('Fetch error:', error);
            Alert.alert('Error', 'Failed to load purchases');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [offset, loading, loadingMore, searchQuery, startDate, endDate]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchPurchases(true);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        fetchPurchases(true);
    }, [startDate, endDate]);

    const handleSearch = () => {
        fetchPurchases(true);
    };

    const clearFilters = () => {
        setSearchQuery('');
        setStartDate(null);
        setEndDate(null);
        fetchPurchases(true);
    };

    const renderPurchaseItem = ({ item }: { item: Purchase }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.typeBadge, { backgroundColor: item.purchase_type === 'Sell' ? Colors.primarySoft : Colors.successSoft }]}>
                    <Text style={[styles.typeText, { color: item.purchase_type === 'Sell' ? Colors.primary : Colors.success }]}>
                        {item.purchase_type || 'Buy'}
                    </Text>
                </View>
                <Text style={styles.dateText}>{item.purchase_date}</Text>
            </View>

            <View style={styles.cardBody}>
                <View style={styles.productInfo}>
                    <Text style={styles.productName}>{item.product?.product_name || item.purchase_name}</Text>
                    <Text style={styles.supplierName}>{item.supplier?.supplier_name || 'Manual Entry'}</Text>
                </View>
                <View style={styles.amountInfo}>
                    <Text style={styles.amountText}>Rs. {item.total_amount}</Text>
                    <Text style={styles.qtyText}>{item.quantity} Qty</Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header & Filters */}
            <View style={styles.filterSection}>
                <View style={styles.searchContainer}>
                    <Search size={20} color={Colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search product or supplier..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    ) || (
                            <TouchableOpacity onPress={handleSearch}>
                                <ChevronRight size={20} color={Colors.primary} />
                            </TouchableOpacity>
                        )}
                </View>

                <View style={styles.dateRow}>
                    <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowStartPicker(true)}
                    >
                        <Calendar size={16} color={Colors.primary} />
                        <Text style={styles.dateButtonText}>
                            {startDate ? formatDate(startDate, 'MMM dd, yyyy') : 'Start Date'}
                        </Text>
                        {startDate && (
                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); setStartDate(null); }}>
                                <X size={14} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowEndPicker(true)}
                    >
                        <Calendar size={16} color={Colors.primary} />
                        <Text style={styles.dateButtonText}>
                            {endDate ? formatDate(endDate, 'MMM dd, yyyy') : 'End Date'}
                        </Text>
                        {endDate && (
                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); setEndDate(null); }}>
                                <X size={14} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                        <Filter size={16} color={Colors.danger} />
                        <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={purchases}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPurchaseItem}
                    contentContainerStyle={styles.listContent}
                    onEndReached={() => hasMore && fetchPurchases()}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <ShoppingCart size={48} color={Colors.border} />
                            <Text style={styles.emptyText}>No purchases found</Text>
                        </View>
                    }
                    ListFooterComponent={
                        loadingMore ? <ActivityIndicator size="small" color={Colors.primary} style={{ margin: 20 }} /> : null
                    }
                />
            )}

            {showStartPicker && (
                <DateTimePicker
                    value={startDate || new Date()}
                    mode="date"
                    onChange={(e, date) => {
                        setShowStartPicker(false);
                        if (date) setStartDate(date);
                    }}
                />
            )}

            {showEndPicker && (
                <DateTimePicker
                    value={endDate || new Date()}
                    mode="date"
                    onChange={(e, date) => {
                        setShowEndPicker(false);
                        if (date) setEndDate(date);
                    }}
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
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterSection: {
        padding: Spacing.md,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F7FAFC',
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        height: 45,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    searchIcon: {
        marginRight: Spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: Colors.text,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    dateButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F7FAFC',
        padding: Spacing.sm,
        borderRadius: Radius.sm,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 6,
    },
    dateButtonText: {
        fontSize: 12,
        color: Colors.textSecondary,
        flex: 1,
    },
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        gap: 4,
    },
    clearText: {
        fontSize: 12,
        color: Colors.danger,
        fontWeight: '600',
    },
    listContent: {
        padding: Spacing.md,
    },
    card: {
        backgroundColor: Colors.card,
        borderRadius: Radius.md,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
        paddingBottom: Spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: '#F7FAFC',
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: Radius.round,
    },
    typeText: {
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    dateText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    cardBody: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 2,
    },
    supplierName: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    amountInfo: {
        alignItems: 'flex-end',
    },
    amountText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    qtyText: {
        fontSize: 12,
        color: Colors.textSecondary,
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
