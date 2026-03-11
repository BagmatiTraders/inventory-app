import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Modal, TextInput, Platform } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { Search, Filter, Truck, Clock, Package, XCircle, Camera, X, Calendar, ChevronDown, RotateCcw } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { DarazRepo, DarazOrder, DarazStore } from '../db/darazRepo';
import { DarazOrderDetailModal } from '../components/DarazOrderDetailModal';

const STATUS_FILTERS = ['All', 'Pending', 'Packed', 'RTS', 'Shipped'];

export default function DarazOrdersScreen() {
    const [mainTab, setMainTab] = useState<'Today' | 'All'>('Today');
    const [subStatus, setSubStatus] = useState('All');
    const [selectedStore, setSelectedStore] = useState<string>('All');
    const [orders, setOrders] = useState<DarazOrder[]>([]);
    const [stores, setStores] = useState<DarazStore[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<DarazOrder | null>(null);
    const [detailVisible, setDetailVisible] = useState(false);

    // Pagination State
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isMoreLoading, setIsMoreLoading] = useState(false);
    const PAGE_SIZE = 25;

    // Advanced Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const getShortName = (name: string) => {
        if (!name) return 'N/A';
        const n = name.toLowerCase();
        if (n.includes('unknown')) return 'N/A';
        if (n.includes('bagmati')) return 'Bagmati';
        if (n.includes('balaju')) return 'Balaju';
        if (n.includes('btas')) return 'BTAS';
        if (n.includes('cosmetic')) return 'Cosmetic';

        const first = name.split(' ')[0] || 'N/A';
        return first.charAt(0).toUpperCase() + first.slice(1);
    };

    const groupedStores = useMemo(() => {
        const groups: Record<string, string[]> = {};
        stores.forEach(s => {
            const short = getShortName(s.seller_account || s.company_name);
            if (!groups[short]) groups[short] = [];
            groups[short].push(s.seller_account);
        });
        return groups;
    }, [stores]);

    const fetchOrders = async (isLoadMore = false) => {
        if (isLoadMore && (!hasMore || isMoreLoading)) return;

        if (isLoadMore) setIsMoreLoading(true);
        else {
            setLoading(true);
            setPage(0);
            setHasMore(true);
        }

        try {
            const accounts = selectedStore === 'All' ? undefined : groupedStores[selectedStore];
            const currentPage = isLoadMore ? page + 1 : 0;

            const data = await DarazRepo.getOrders({
                status: subStatus,
                todayOnly: mainTab === 'Today',
                sellerAccounts: accounts,
                searchQuery: searchQuery,
                startDate: startDate?.toISOString().split('T')[0],
                endDate: endDate?.toISOString().split('T')[0],
                page: currentPage,
                pageSize: mainTab === 'Today' ? 1000 : PAGE_SIZE
            });

            if (isLoadMore) {
                setOrders(prev => {
                    const existingIds = new Set(prev.map(o => o.id));
                    const newUnique = data.filter(item => !existingIds.has(item.id));
                    return [...prev, ...newUnique];
                });
                setPage(currentPage);
            } else {
                setOrders(data);
            }

            if (mainTab === 'Today') {
                setHasMore(false);
            } else if (data.length < PAGE_SIZE) {
                setHasMore(false);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setIsMoreLoading(false);
        }
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSubStatus('All');
        setSelectedStore('All');
        setStartDate(null);
        setEndDate(null);
    };

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        setSearchQuery(data);
        setIsScanning(false);
    };

    const openScanner = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) return;
        }
        setIsScanning(true);
    };

    const fetchStores = async () => {
        try {
            const data = await DarazRepo.getStores();
            setStores(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchStores();
    }, []);

    useEffect(() => {
        fetchOrders(false);
    }, [mainTab, subStatus, selectedStore, startDate, endDate]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchOrders(false);
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const formatPrice = (amount: any) => {
        const value = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-NP', {
            style: 'currency',
            currency: 'NPR',
            minimumFractionDigits: 0
        }).format(value).replace('NPR', 'रु');
    };

    const handleOrderPress = (order: DarazOrder) => {
        setSelectedOrder(order);
        setDetailVisible(true);
    };

    return (
        <View style={styles.container}>
            <View style={styles.topFilterBar}>
                <TouchableOpacity
                    style={[styles.mainTabBtn, mainTab === 'Today' && styles.activeMainTab]}
                    onPress={() => setMainTab('Today')}
                >
                    <Text style={[styles.mainTabText, mainTab === 'Today' && styles.activeMainTabText]}>Today Order</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.mainTabBtn, mainTab === 'All' && styles.activeMainTab]}
                    onPress={() => setMainTab('All')}
                >
                    <Text style={[styles.mainTabText, mainTab === 'All' && styles.activeMainTabText]}>All Order</Text>
                </TouchableOpacity>
            </View>

            {mainTab === 'Today' && (
                <View style={styles.subFilterBar}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFilterContent}>
                        {STATUS_FILTERS.map((status) => (
                            <TouchableOpacity
                                key={status}
                                style={[styles.statusChip, subStatus === status && styles.activeStatusChip]}
                                onPress={() => setSubStatus(status)}
                            >
                                <Text style={[styles.statusChipText, subStatus === status && styles.activeStatusChipText]}>
                                    {status}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {mainTab === 'Today' && (
                <View style={styles.storeFilterBar}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeFilterContent}>
                        <TouchableOpacity
                            style={[styles.storeChip, selectedStore === 'All' && styles.activeStoreChip]}
                            onPress={() => setSelectedStore('All')}
                        >
                            <Text style={[styles.storeChipText, selectedStore === 'All' && styles.activeStoreChipText]}>All Stores</Text>
                        </TouchableOpacity>
                        {Object.keys(groupedStores).map((shortName) => (
                            <TouchableOpacity
                                key={shortName}
                                style={[styles.storeChip, selectedStore === shortName && styles.activeStoreStoreChip]}
                                onPress={() => setSelectedStore(shortName)}
                            >
                                <Text style={[styles.storeChipText, selectedStore === shortName && styles.activeStoreStoreChipText]}>
                                    {shortName}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {mainTab === 'All' && (
                <View style={styles.advancedFilterContainer}>
                    <View style={styles.searchBarWrapper}>
                        <View style={styles.searchInputContainer}>
                            <Search size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Order #, Tracking, Product..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <X size={18} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={openScanner} style={styles.camBtn}>
                                <Camera size={20} color={Colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.datePickerRow}>
                        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
                            <Calendar size={14} color={Colors.textSecondary} />
                            <Text style={styles.dateBtnText}>{startDate ? startDate.toLocaleDateString() : 'Start Date'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
                            <Calendar size={14} color={Colors.textSecondary} />
                            <Text style={styles.dateBtnText}>{endDate ? endDate.toLocaleDateString() : 'End Date'}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.dropdownRow}>
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={subStatus}
                                onValueChange={(v: string) => setSubStatus(v)}
                                style={styles.picker}
                            >
                                {STATUS_FILTERS.map(s => <Picker.Item key={s} label={s} value={s} />)}
                            </Picker>
                            <ChevronDown size={14} color={Colors.textSecondary} style={styles.pickerIcon} />
                        </View>
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={selectedStore}
                                onValueChange={(v: string) => setSelectedStore(v)}
                                style={styles.picker}
                            >
                                <Picker.Item label="All Stores" value="All" />
                                {Object.keys(groupedStores).map(s => <Picker.Item key={s} label={s} value={s} />)}
                            </Picker>
                            <ChevronDown size={14} color={Colors.textSecondary} style={styles.pickerIcon} />
                        </View>
                        <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters}>
                            <RotateCcw size={18} color={Colors.danger} />
                        </TouchableOpacity>
                    </View>

                    {showStartPicker && (
                        <DateTimePicker
                            value={startDate || new Date()}
                            mode="date"
                            display="default"
                            onChange={(e, d) => { setShowStartPicker(false); if (d) setStartDate(d); }}
                        />
                    )}
                    {showEndPicker && (
                        <DateTimePicker
                            value={endDate || new Date()}
                            mode="date"
                            display="default"
                            onChange={(e, d) => { setShowEndPicker(false); if (d) setEndDate(d); }}
                        />
                    )}
                </View>
            )}

            <View style={styles.countSummaryBar}>
                <Text style={styles.countLabel}>
                    {selectedStore === 'All' ? 'All Stores' : selectedStore}
                    {subStatus !== 'All' ? ` - ${subStatus}` : ''} Orders
                </Text>
                <Text style={styles.countValue}>
                    {orders.length === 0 && loading ? '...' : orders.length}
                    {hasMore && mainTab === 'All' ? '+' : ''}
                </Text>
            </View>

            {loading && page === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContainer}
                    onRefresh={() => fetchOrders(false)}
                    refreshing={loading}
                    onEndReached={() => fetchOrders(true)}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={() => (
                        isMoreLoading ? (
                            <ActivityIndicator style={{ paddingVertical: 20 }} color={Colors.primary} />
                        ) : null
                    )}
                    renderItem={({ item }) => {
                        const status = item.order_status.toLowerCase();
                        const isCancelled = status === 'cancel' || status === 'cancelled' || status === 'unpaid';
                        const isShipped = status === 'shipped';
                        const isPending = status === 'pending';
                        const isReady = status === 'ready to ship' || status === 'packed';

                        const getStatusStyle = () => {
                            if (isShipped) return { color: '#2E7D32', bg: '#E8F5E9' };
                            if (isPending) return { color: '#F9A825', bg: '#FFF9C4' };
                            if (isReady) return { color: '#1565C0', bg: '#E3F2FD' };
                            if (isCancelled) return { color: '#C62828', bg: '#FFEBEE' };
                            return { color: Colors.textSecondary, bg: Colors.background };
                        };

                        const storeStyle = (() => {
                            const n = item.seller_account?.toLowerCase() || '';
                            if (n.includes('bagmati')) return { color: '#1976D2', bg: '#E3F2FD' };
                            if (n.includes('balaju')) return { color: '#E65100', bg: '#FFF3E0' };
                            if (n.includes('btas')) return { color: '#7B1FA2', bg: '#F3E5F5' };
                            if (n.includes('cosmetic')) return { color: '#C2185B', bg: '#FCE4EC' };
                            return { color: Colors.textSecondary, bg: Colors.background };
                        })();

                        const statusStyle = getStatusStyle();
                        const dateObj = new Date(item.daraz_created_at || item.order_date);
                        const shortDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear().toString().slice(-2)}`;
                        const shortTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                            <TouchableOpacity
                                style={[styles.orderCard, isCancelled && styles.cancelledCard]}
                                onPress={() => handleOrderPress(item)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.cardRow}>
                                    <View>
                                        <Text style={styles.orderId}>#{item.order_number}</Text>
                                        <Text style={styles.trackingText}>{item.tracking_number || 'No Tracking'}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.dateText}>{shortDate}</Text>
                                        <Text style={styles.timeText}>{shortTime}</Text>
                                    </View>
                                </View>
                                <View style={styles.customerRow}>
                                    <Text style={styles.customerName}>{item.customer_name}</Text>
                                </View>
                                <View style={styles.productsSection}>
                                    {(item.items_detail || []).map((prod, idx) => (
                                        <View key={idx} style={styles.productRow}>
                                            <Text style={styles.productName} numberOfLines={2}>{prod.name || prod.sku}</Text>
                                            <Text style={styles.qtyPriceText}>{prod.quantity} X {formatPrice(prod.item_price)}</Text>
                                        </View>
                                    ))}
                                    {(!item.items_detail || item.items_detail.length === 0) && (
                                        <View style={styles.productRow}>
                                            <Text style={styles.productName}>{item.first_product_name || 'Unknown'}</Text>
                                            <Text style={styles.qtyPriceText}>{item.total_quantity || 1} X {formatPrice(item.grand_total / (item.total_quantity || 1))}</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.footerRow}>
                                    <View style={[styles.storeBadge, { backgroundColor: storeStyle.bg }]}>
                                        <Text style={[styles.storeBadgeText, { color: storeStyle.color }]}>{getShortName(item.seller_account)}</Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                        <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>{item.order_status}</Text>
                                    </View>
                                    <Text style={styles.totalAmountText}>{formatPrice(item.grand_total)}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No orders found</Text>}
                />
            )}
            <Modal visible={isScanning} animationType="slide">
                <View style={styles.scannerWrapper}>
                    <CameraView onBarcodeScanned={handleBarCodeScanned} style={StyleSheet.absoluteFillObject} />
                    <TouchableOpacity style={styles.closeScanner} onPress={() => setIsScanning(false)}><X size={32} color="#FFF" /></TouchableOpacity>
                    <View style={styles.scannerOverlay}><View style={styles.scanFrame} /><Text style={styles.scanText}>Scanning...</Text></View>
                </View>
            </Modal>

            <DarazOrderDetailModal
                order={selectedOrder}
                visible={detailVisible}
                onClose={() => setDetailVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    topFilterBar: { flexDirection: 'row', backgroundColor: Colors.card, padding: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
    mainTabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md },
    activeMainTab: { backgroundColor: Colors.primary },
    mainTabText: { fontWeight: 'bold', color: Colors.textSecondary },
    activeMainTabText: { color: '#FFF' },
    storeFilterBar: { backgroundColor: Colors.card, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
    storeFilterContent: { paddingHorizontal: 16, gap: 6 },
    storeChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
    activeStoreChip: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    activeStoreStoreChip: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
    storeChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
    activeStoreChipText: { color: '#FFF' },
    activeStoreStoreChipText: { color: Colors.primary },
    subFilterBar: { backgroundColor: Colors.card, paddingVertical: 8 },
    subFilterContent: { paddingHorizontal: 16, gap: 8 },
    statusChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
    activeStatusChip: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
    statusChipText: { fontSize: 13, color: Colors.textSecondary },
    activeStatusChipText: { color: Colors.primary, fontWeight: 'bold' },
    listContainer: { padding: 12 },
    orderCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
    cancelledCard: { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    orderId: { fontSize: 14, fontWeight: 'bold', color: Colors.text },
    trackingText: { fontSize: 11, color: Colors.textSecondary },
    dateText: { fontSize: 12, fontWeight: '600', color: Colors.text },
    timeText: { fontSize: 10, color: Colors.textSecondary },
    customerRow: { marginBottom: 6 },
    customerName: { fontSize: 14, fontWeight: '700', color: Colors.text },
    productsSection: { marginBottom: 8, backgroundColor: Colors.background, padding: 6, borderRadius: 4 },
    productRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
    productName: { fontSize: 12, color: Colors.text, flex: 1 },
    qtyPriceText: { fontSize: 12, fontWeight: 'bold' },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.border },
    storeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    storeBadgeText: { fontSize: 10, fontWeight: 'bold' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    statusBadgeText: { fontSize: 10, fontWeight: 'bold' },
    totalAmountText: { fontSize: 14, fontWeight: 'bold', color: Colors.primary },
    emptyText: { textAlign: 'center', marginTop: 40, color: Colors.textSecondary },
    countSummaryBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
    countLabel: { fontSize: 13, fontWeight: 'bold' },
    countValue: { fontSize: 13, fontWeight: 'bold', color: Colors.primary },
    advancedFilterContainer: { backgroundColor: Colors.card, padding: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
    searchBarWrapper: { width: '100%' },
    searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: Radius.md, paddingHorizontal: 8, borderWidth: 1, borderColor: Colors.border, height: 44 },
    searchInput: { flex: 1, fontSize: 14 },
    camBtn: { padding: 6 },
    datePickerRow: { flexDirection: 'row', gap: 8 },
    dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: Radius.md, padding: 10, gap: 6, borderWidth: 1, borderColor: Colors.border },
    dateBtnText: { fontSize: 12 },
    dropdownRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    pickerWrapper: { flex: 1, backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, height: 48, justifyContent: 'center' },
    picker: { width: '100%', backgroundColor: 'transparent' },
    pickerIcon: { position: 'absolute', right: 4, top: 16, pointerEvents: 'none' },
    clearFiltersBtn: { width: 44, height: 48, backgroundColor: '#FFE5E5', borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFCDD2' },
    scannerWrapper: { flex: 1 },
    scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    closeScanner: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
    scanFrame: { width: 250, height: 150, borderWidth: 2, borderColor: Colors.primary, borderRadius: 12 },
    scanText: { color: '#FFF', marginTop: 20 },
});
