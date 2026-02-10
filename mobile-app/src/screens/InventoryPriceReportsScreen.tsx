import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, TextInput, Modal, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, Package, Box, RefreshCcw, X, Edit2, Check, ExternalLink } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { PriceReportRepo, InventoryPriceReportItem } from '../db/priceReportRepo';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';

const BATCH_SIZE = 100;

export default function InventoryPriceReportsScreen() {
    const navigation = useNavigation();

    // Data State
    const [reports, setReports] = useState<InventoryPriceReportItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Detail/Edit State
    const [selectedProduct, setSelectedProduct] = useState<InventoryPriceReportItem | null>(null);
    const [isDetailVisible, setIsDetailVisible] = useState(false);
    const [isEditVisible, setIsEditVisible] = useState(false);
    const [editPrice, setEditPrice] = useState('');
    const [isSavingPrice, setIsSavingPrice] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchReports = async (isNewSearch = false) => {
        if (loading || (loadingMore && !isNewSearch)) return;

        if (isNewSearch) {
            setLoading(true);
            setOffset(0);
        } else {
            setLoadingMore(true);
        }

        try {
            const currentOffset = isNewSearch ? 0 : offset;
            const { data, totalCount: count } = await PriceReportRepo.getInventoryPriceReports({
                from: currentOffset,
                to: currentOffset + BATCH_SIZE - 1,
                search: debouncedSearch
            });

            if (isNewSearch) {
                setReports(data);
            } else {
                setReports(prev => [...prev, ...data]);
            }

            setTotalCount(count);
            setOffset(currentOffset + data.length);
            setHasMore(currentOffset + data.length < count);
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchReports(true);
    }, [debouncedSearch]);

    const handleLoadMore = () => {
        if (hasMore && !loadingMore && !loading) {
            fetchReports(false);
        }
    };

    const renderPriceItem = (label: string, value: number | null | undefined, color: string) => (
        <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{label}</Text>
            <Text style={[styles.priceValue, { color }]}>
                {value ? `रु ${value.toLocaleString()}` : '-'}
            </Text>
        </View>
    );

    const renderReportCard = ({ item }: { item: InventoryPriceReportItem, index: number }) => {
        const isCombo = item.product_type === 'combo';
        const comboCount = item.product_combos?.[0]?.count || 0;
        const typeLabel = isCombo ? (comboCount === 1 ? 'Variation' : 'Combo') : 'Single';

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => {
                    setSelectedProduct(item);
                    setIsDetailVisible(true);
                }}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.imageContainer}>
                        {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={styles.productImage} />
                        ) : (
                            <View style={styles.placeholderImage}>
                                <Package size={20} color={Colors.textSecondary} />
                            </View>
                        )}
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={styles.productName} numberOfLines={2}>{item.product_name}</Text>
                        <View style={styles.metaRow}>
                            <Text style={styles.productCode}>ID: {item.product_code || '-'}</Text>
                            <View style={[
                                styles.typeBadge,
                                isCombo ? styles.typeBadgeCombo : styles.typeBadgeSingle
                            ]}>
                                {isCombo ? <Package size={10} color={Colors.primary} /> : <Box size={10} color={Colors.textSecondary} />}
                                <Text style={[
                                    styles.typeText,
                                    isCombo ? styles.typeTextCombo : styles.typeTextSingle
                                ]}>
                                    {typeLabel}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.pricesGrid}>
                    {renderPriceItem('Est. Price', item.est_price, Colors.primary)}
                    {renderPriceItem('Last Price', item.last_price, Colors.text)}
                    {renderPriceItem('Low Price', item.low_price, Colors.success)}
                    {renderPriceItem('Avg Price', item.average_price, Colors.orange)}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Custom Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Inventory Reports</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                    <Search size={20} color={Colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search products..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={Colors.textSecondary}
                    />
                </View>
            </View>
            {loading && reports.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading reports...</Text>
                </View>
            ) : (
                <FlatList
                    data={reports}
                    keyExtractor={(item) => item.product_id}
                    renderItem={renderReportCard}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <View style={styles.listHeader}>
                            <Text style={styles.resultsText}>
                                {totalCount > 0 ? `Showing ${reports.length} of ${totalCount} entries` : 'No products found'}
                            </Text>
                        </View>
                    }
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={styles.footerLoader}>
                                <ActivityIndicator size="small" color={Colors.primary} />
                                <Text style={styles.footerText}>Loading more...</Text>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        loading ? null : (
                            <View style={styles.emptyContainer}>
                                <Package size={48} color={Colors.border} />
                                <Text style={styles.emptyText}>No products found.</Text>
                            </View>
                        )
                    }
                />
            )}

            {/* Product Detail Modal */}
            <Modal
                visible={isDetailVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsDetailVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.detailCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Product Details</Text>
                            <TouchableOpacity onPress={() => setIsDetailVisible(false)} style={styles.closeButton}>
                                <X size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.detailContent}>
                            <View style={styles.detailImageContainer}>
                                {selectedProduct?.image_url ? (
                                    <Image source={{ uri: selectedProduct.image_url }} style={styles.detailImage} />
                                ) : (
                                    <View style={styles.detailPlaceholderImage}>
                                        <Package size={48} color={Colors.border} />
                                    </View>
                                )}
                            </View>

                            <Text style={styles.detailName}>{selectedProduct?.product_name}</Text>
                            <Text style={styles.detailCode}>Item ID: {selectedProduct?.product_code || '-'}</Text>

                            <View style={styles.detailStatsContainer}>
                                <View style={styles.detailStatBox}>
                                    <Text style={styles.statLabel}>Est. Price</Text>
                                    <Text style={[styles.statValue, { color: Colors.primary }]}>
                                        रु {selectedProduct?.est_price?.toLocaleString() || '0'}
                                    </Text>
                                </View>
                                <View style={styles.detailStatBox}>
                                    <Text style={styles.statLabel}>Last Price</Text>
                                    <Text style={styles.statValue}>
                                        {selectedProduct?.last_price ? `रु ${selectedProduct.last_price.toLocaleString()}` : '-'}
                                    </Text>
                                </View>
                                <View style={[styles.detailStatBox, { borderRightWidth: 0 }]}>
                                    <Text style={styles.statLabel}>Low Price</Text>
                                    <Text style={[styles.statValue, { color: Colors.success }]}>
                                        {selectedProduct?.low_price ? `रु ${selectedProduct.low_price.toLocaleString()}` : '-'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Average Price</Text>
                                <Text style={[styles.infoValue, { color: Colors.orange }]}>
                                    {selectedProduct?.average_price ? `रु ${selectedProduct.average_price.toLocaleString()}` : '-'}
                                </Text>
                            </View>

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>SKU 1</Text>
                                <Text style={styles.infoValue}>{selectedProduct?.seller_sku1 || '-'}</Text>
                            </View>

                            {selectedProduct?.product_type === 'combo' && (
                                <View style={styles.noticeBox}>
                                    <Text style={styles.noticeText}>
                                        Note: Estimated price for {(selectedProduct.product_combos?.[0]?.count || 0) === 1 ? 'variations' : 'combos'} is automatically calculated from components.
                                    </Text>
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[
                                    styles.editButton,
                                    selectedProduct?.product_type === 'combo' && styles.disabledButton
                                ]}
                                disabled={selectedProduct?.product_type === 'combo'}
                                onPress={() => {
                                    setEditPrice(selectedProduct?.est_price?.toString() || '');
                                    setIsEditVisible(true);
                                }}
                            >
                                <Edit2 size={20} color="white" />
                                <Text style={styles.editButtonText}>Edit Est Price</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Price Modal */}
            <Modal
                visible={isEditVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsEditVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.editPriceCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Estimated Price</Text>
                            <TouchableOpacity onPress={() => setIsEditVisible(false)}>
                                <X size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.editContent}>
                            <Text style={styles.inputLabel}>New Estimated Price (रु)</Text>
                            <TextInput
                                style={styles.priceInput}
                                value={editPrice}
                                onChangeText={setEditPrice}
                                keyboardType="numeric"
                                autoFocus
                                placeholder="Enter amount"
                            />
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setIsEditVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveButton, isSavingPrice && styles.disabledButton]}
                                disabled={isSavingPrice}
                                onPress={async () => {
                                    if (!selectedProduct) return;
                                    const price = parseFloat(editPrice);
                                    if (isNaN(price)) {
                                        Alert.alert('Error', 'Please enter a valid price.');
                                        return;
                                    }

                                    setIsSavingPrice(true);
                                    try {
                                        await PriceReportRepo.updateProductEstPrice(selectedProduct.product_id, price);

                                        // Update local state
                                        setReports(prev => prev.map(p =>
                                            p.product_id === selectedProduct.product_id ? { ...p, est_price: price } : p
                                        ));

                                        // Update selected product in detail view
                                        setSelectedProduct(prev => prev ? { ...prev, est_price: price } : null);

                                        Alert.alert('Success', 'Estimated price updated successfully.');
                                        setIsEditVisible(false);
                                    } catch (err) {
                                        Alert.alert('Error', 'Failed to update price.');
                                    } finally {
                                        setIsSavingPrice(false);
                                    }
                                }}
                            >
                                {isSavingPrice ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
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
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    searchContainer: {
        padding: Spacing.md,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    searchIcon: {
        marginRight: Spacing.xs,
    },
    searchInput: {
        flex: 1,
        height: 44,
        fontSize: 15,
        color: Colors.text,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: Spacing.sm,
        color: Colors.textSecondary,
    },
    listContent: {
        padding: Spacing.md,
        paddingBottom: Spacing.xl,
    },
    listHeader: {
        marginBottom: Spacing.sm,
    },
    resultsText: {
        fontSize: 13,
        color: Colors.textSecondary,
        fontWeight: '500',
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
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        marginBottom: Spacing.sm,
    },
    imageContainer: {
        width: 60,
        height: 60,
        borderRadius: Radius.md,
        backgroundColor: Colors.background,
        overflow: 'hidden',
        marginRight: Spacing.md,
    },
    productImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    productName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.text,
        lineHeight: 20,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    productCode: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontFamily: 'System', // Use mono-like font if available
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: Radius.round,
        borderWidth: 1,
        gap: 4,
    },
    typeBadgeCombo: {
        backgroundColor: Colors.primarySoft,
        borderColor: Colors.primary + '33',
    },
    typeBadgeSingle: {
        backgroundColor: Colors.cardAlt,
        borderColor: Colors.border,
    },
    typeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    typeTextCombo: {
        color: Colors.primary,
    },
    typeTextSingle: {
        color: Colors.textSecondary,
    },
    pricesGrid: {
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    priceRow: {
        width: '50%',
        paddingVertical: 4,
    },
    priceLabel: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginBottom: 2,
    },
    priceValue: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    footerLoader: {
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    emptyContainer: {
        paddingVertical: 100,
        alignItems: 'center',
    },
    emptyText: {
        marginTop: Spacing.md,
        color: Colors.textSecondary,
        fontSize: 15,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    detailCard: {
        backgroundColor: Colors.background,
        borderTopLeftRadius: Radius.lg * 1.5,
        borderTopRightRadius: Radius.lg * 1.5,
        height: '80%',
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    closeButton: {
        padding: 4,
    },
    detailContent: {
        padding: Spacing.lg,
    },
    detailImageContainer: {
        width: '100%',
        height: 200,
        borderRadius: Radius.lg,
        backgroundColor: Colors.cardAlt,
        overflow: 'hidden',
        marginBottom: Spacing.md,
    },
    detailImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    detailPlaceholderImage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 4,
    },
    detailCode: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: Spacing.lg,
    },
    detailStatsContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        borderRadius: Radius.md,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.lg,
    },
    detailStatBox: {
        flex: 1,
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: Colors.border,
    },
    statLabel: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.text,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    infoLabel: {
        fontSize: 15,
        color: Colors.textSecondary,
    },
    infoValue: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.text,
    },
    noticeBox: {
        marginTop: Spacing.lg,
        padding: Spacing.md,
        backgroundColor: Colors.warningSoft,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.warning + '33',
    },
    noticeText: {
        fontSize: 12,
        color: Colors.warning,
        lineHeight: 18,
    },
    modalFooter: {
        padding: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        flexDirection: 'row',
        gap: Spacing.md,
    },
    editButton: {
        flex: 1,
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
        borderRadius: Radius.md,
        gap: 8,
    },
    editButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    disabledButton: {
        opacity: 0.5,
        backgroundColor: Colors.textSecondary,
    },
    // Edit Modal Styles
    editPriceCard: {
        backgroundColor: Colors.background,
        borderRadius: Radius.lg,
        margin: Spacing.lg,
        marginTop: 'auto',
        marginBottom: 'auto',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
    },
    editContent: {
        padding: Spacing.lg,
    },
    inputLabel: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 8,
    },
    priceInput: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.primary,
        padding: Spacing.md,
        borderBottomWidth: 2,
        borderBottomColor: Colors.primary,
    },
    cancelButton: {
        flex: 1,
        padding: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    cancelButtonText: {
        color: Colors.textSecondary,
        fontWeight: 'bold',
    },
    saveButton: {
        flex: 2,
        backgroundColor: Colors.success,
        padding: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.md,
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});
