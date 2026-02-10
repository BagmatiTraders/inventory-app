import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Search, X } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { useNavigation } from '@react-navigation/native';
import { useDataStore } from '../store/useDataStore';
import { Product } from '../db/repo';

export default function InventoryListScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { products, refreshData, syncPurchasingData, isLoading } = useDataStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await syncPurchasingData();
        setRefreshing(false);
    };

    useEffect(() => {
        setFilteredProducts(products);
    }, [products]);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredProducts(products);
        } else {
            const lowerQuery = searchQuery.toLowerCase();
            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(lowerQuery) ||
                (p.sku && p.sku.toLowerCase().includes(lowerQuery)) ||
                (p.id && p.id.toLowerCase().includes(lowerQuery))
            );
            setFilteredProducts(filtered);
        }
    }, [searchQuery, products]);

    const renderItem = ({ item }: { item: Product }) => (
        <View style={styles.productCard}>
            {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.productImage} resizeMode="cover" />
            ) : (
                <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
            )}
            <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.productSku}>SKU: {item.sku || 'N/A'}</Text>
                <View style={styles.detailsRow}>
                    <View style={styles.idContainer}>
                        <Text style={styles.idLabel}>ID:</Text>
                        <Text style={styles.productId} numberOfLines={1} ellipsizeMode="middle">{String(item.product_id || 'N/A')}</Text>
                    </View>
                    <View style={[styles.typeTag, { backgroundColor: item.product_type === 'combo' ? Colors.primarySoft : Colors.background }]}>
                        <Text style={[styles.typeText, { color: item.product_type === 'combo' ? Colors.primary : Colors.textSecondary }]}>
                            {item.product_type ? item.product_type.toUpperCase() : 'SINGLE'}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Inventory List</Text>
                    <Text style={styles.headerSubtitle}>{products.length} Products</Text>
                </View>
                <View style={{ width: 24 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBox}>
                    <Search size={20} color={Colors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search products..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={Colors.textSecondary}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={18} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Product List */}
            <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={{
                    padding: Spacing.md,
                    paddingBottom: insets.bottom + Spacing.md
                }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No products found</Text>
                    </View>
                }
                refreshing={refreshing}
                onRefresh={onRefresh}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        height: 60,
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, textAlign: 'center' },
    headerSubtitle: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
    backButton: { padding: 4 },
    searchContainer: {
        padding: Spacing.md,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        height: 44,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    searchInput: {
        flex: 1,
        marginLeft: Spacing.sm,
        color: Colors.text,
    },
    productCard: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        borderRadius: Radius.md,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    productImage: {
        width: 50,
        height: 50,
        borderRadius: Radius.sm,
        marginRight: Spacing.md,
        backgroundColor: Colors.background,
    },
    imagePlaceholder: {
        width: 50,
        height: 50,
        borderRadius: Radius.sm,
        backgroundColor: Colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    imagePlaceholderText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    productInfo: { flex: 1, justifyContent: 'center' },
    productName: { fontWeight: '600', color: Colors.text, fontSize: 16, marginBottom: 4 },
    productSku: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
    detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    idContainer: { flex: 1, marginRight: 8, flexDirection: 'row', alignItems: 'center' },
    idLabel: { fontSize: 10, color: Colors.textSecondary, marginRight: 4 },
    productId: { fontSize: 10, color: Colors.text, fontFamily: 'monospace', backgroundColor: Colors.background, paddingVertical: 2, paddingHorizontal: 4, borderRadius: 4 },
    typeTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: Colors.border },
    typeText: { fontSize: 10, fontWeight: '600' },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: Colors.textSecondary, fontSize: 16 },
});
