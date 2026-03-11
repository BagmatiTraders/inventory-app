import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { X, Calendar, Hash, User, Package, Plus, Info } from 'lucide-react-native';
import { DarazOrder, DarazRepo } from '../db/darazRepo';
import OrderPlanModal from './OrderPlanModal';

interface DarazOrderDetailModalProps {
    order: DarazOrder | null;
    visible: boolean;
    onClose: () => void;
}

export const DarazOrderDetailModal: React.FC<DarazOrderDetailModalProps> = ({ order, visible, onClose }) => {
    const [stocks, setStocks] = useState<Record<string, number>>({});
    const [loadingStock, setLoadingStock] = useState(false);

    // Plan Modal State
    const [planModalVisible, setPlanModalVisible] = useState(false);
    const [selectedPlanItem, setSelectedPlanItem] = useState<{
        name: string;
        productId?: string;
        qty: number;
        image?: string;
    } | null>(null);

    useEffect(() => {
        if (order && visible) {
            fetchStock();
        } else {
            setStocks({});
        }
    }, [order, visible]);

    const fetchStock = async () => {
        if (!order) return;
        setLoadingStock(true);
        try {
            const items = order.items_detail || [];
            // Collect both IDs and Names for robust matching
            const identifiers: string[] = [];

            items.forEach(item => {
                if (item.product_id) identifiers.push(item.product_id);
                if (item.name || item.product_name) identifiers.push(item.name || item.product_name);
            });

            // Also include first_product_name if no items_detail
            if (identifiers.length === 0 && order.first_product_name) {
                identifiers.push(order.first_product_name);
            }

            if (identifiers.length > 0) {
                const stockData = await DarazRepo.getLiveOrderStock(identifiers);
                setStocks(stockData);
            }
        } catch (error) {
            console.error('Failed to fetch stock:', error);
        } finally {
            setLoadingStock(false);
        }
    };

    const handleAddToPlan = (item: any) => {
        if (!order) return;
        const productName = item.name || item.product_name || order.first_product_name;
        // item might have image_url or similar. 
        // If item is just a constructed object from fallback, it might not have image.
        // Try to find image from stocks? No.
        // Assuming item has image_url if from detailed list.
        const img = item.image_url || item.product_main_image || item.sku_image;

        setSelectedPlanItem({
            name: productName,
            productId: item.product_id,
            qty: item.quantity || order.total_quantity || 1,
            image: img
        });
        setPlanModalVisible(true);
    };

    if (!order) return null;

    const status = order.order_status.toLowerCase();
    const canAdd = ['pending', 'packed', 'ready to ship'].includes(status);

    const formatPrice = (amount: any) => {
        const value = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-NP', {
            style: 'currency',
            currency: 'NPR',
            minimumFractionDigits: 0
        }).format(value).replace('NPR', 'रु');
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerTitle}>Order Details</Text>
                            <Text style={styles.headerSubtitle}>#{order.order_number}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color={Colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Status section */}
                        <View style={styles.section}>
                            <View style={styles.statusRow}>
                                <View style={[styles.statusBadge, getStatusBadgeStyle(order.order_status)]}>
                                    <Text style={[styles.statusText, { color: getStatusColor(order.order_status) }]}>
                                        {order.order_status}
                                    </Text>
                                </View>
                                <Text style={styles.storeText}>{order.seller_account}</Text>
                            </View>
                        </View>

                        {/* Order Summary */}
                        <View style={styles.section}>
                            <View style={styles.infoRow}>
                                <Calendar size={16} color={Colors.textSecondary} />
                                <Text style={styles.infoLabel}>Date:</Text>
                                <Text style={styles.infoValue}>{formatDate(order.daraz_created_at || order.order_date)}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Hash size={16} color={Colors.textSecondary} />
                                <Text style={styles.infoLabel}>Invoice No:</Text>
                                <Text style={styles.infoValue}>{order.tracking_number || 'N/A'}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <User size={16} color={Colors.textSecondary} />
                                <Text style={styles.infoLabel}>Customer:</Text>
                                <Text style={styles.infoValue}>{order.customer_name}</Text>
                            </View>
                        </View>

                        {/* Products Table/List */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Order Items</Text>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderText, { flex: 3 }]}>Product</Text>
                                <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Qty</Text>
                                <Text style={[styles.tableHeaderText, { flex: 2, textAlign: 'right' }]}>Amount</Text>
                            </View>

                            {(order.items_detail || []).map((item, idx) => (
                                <View key={idx} style={styles.tableRow}>
                                    <Text style={[styles.productName, { flex: 3 }]}>{item.name || item.product_name}</Text>
                                    <Text style={[styles.productQty, { flex: 1, textAlign: 'center' }]}>{item.quantity}</Text>
                                    <Text style={[styles.productAmount, { flex: 2, textAlign: 'right' }]}>
                                        {formatPrice((item.quantity || 1) * (item.item_price || 0))}
                                    </Text>
                                </View>
                            ))}

                            {(!order.items_detail || order.items_detail.length === 0) && (
                                <View style={styles.tableRow}>
                                    <Text style={[styles.productName, { flex: 3 }]}>{order.first_product_name}</Text>
                                    <Text style={[styles.productQty, { flex: 1, textAlign: 'center' }]}>{order.total_quantity || 1}</Text>
                                    <Text style={[styles.productAmount, { flex: 2, textAlign: 'right' }]}>
                                        {formatPrice(order.grand_total)}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Grand Total</Text>
                                <Text style={styles.totalValue}>{formatPrice(order.grand_total)}</Text>
                            </View>
                        </View>

                        {/* Stock Analysis Section */}
                        <View style={[styles.section, styles.stockSection]}>
                            <View style={styles.sectionHeader}>
                                <Package size={18} color={Colors.primary} />
                                <Text style={styles.sectionTitle}>Stock Analysis</Text>
                                <Text style={{ fontSize: 10, color: Colors.textSecondary, marginLeft: 8 }}>(Live)</Text>
                                {loadingStock && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />}
                            </View>

                            <View style={styles.stockGrid}>
                                {(order.items_detail || []).map((item, idx) => {
                                    const productName = item.name || item.product_name;
                                    const productId = item.product_id;
                                    const stock = (productId && stocks[productId] !== undefined)
                                        ? stocks[productId]
                                        : (stocks[productName] ?? '-');

                                    return (
                                        <View key={idx} style={styles.stockItemCard}>
                                            <View style={styles.stockInfo}>
                                                <Text style={styles.stockProductName} numberOfLines={1}>{productName}</Text>
                                                <View style={styles.stockBadge}>
                                                    <Text style={styles.stockLabel}>Stock: </Text>
                                                    <Text style={[styles.stockValue, getStockColorStyle(stock)]}>{stock}</Text>
                                                </View>
                                            </View>
                                            {canAdd && (
                                                <TouchableOpacity
                                                    style={styles.addBtn}
                                                    activeOpacity={0.7}
                                                    onPress={() => handleAddToPlan(item)}
                                                >
                                                    <Plus size={16} color="#FFF" />
                                                    <Text style={styles.addBtnText}>Add</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })}

                                {(!order.items_detail || order.items_detail.length === 0) && order.first_product_name && (
                                    <View style={styles.stockItemCard}>
                                        <View style={styles.stockInfo}>
                                            <Text style={styles.stockProductName} numberOfLines={1}>{order.first_product_name}</Text>
                                            <View style={styles.stockBadge}>
                                                <Text style={styles.stockLabel}>Stock: </Text>
                                                <Text style={[styles.stockValue, getStockColorStyle(stocks[order.first_product_name] ?? '-')]} >
                                                    {stocks[order.first_product_name] ?? '-'}
                                                </Text>
                                            </View>
                                        </View>
                                        {canAdd && (
                                            <TouchableOpacity
                                                style={styles.addBtn}
                                                activeOpacity={0.7}
                                                onPress={() => handleAddToPlan({
                                                    name: order.first_product_name,
                                                    quantity: order.total_quantity
                                                })}
                                            >
                                                <Plus size={16} color="#FFF" />
                                                <Text style={styles.addBtnText}>Add</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </View>

                            {!canAdd && (
                                <View style={styles.infoNotice}>
                                    <Info size={14} color={Colors.textSecondary} />
                                    <Text style={styles.infoNoticeText}>
                                        Add button is only available for Pending, Packed, or Ready to Ship orders.
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Spacing for bottom */}
                        <View style={{ height: 40 }} />
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.footerBtn} onPress={onClose}>
                            <Text style={styles.footerBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Order Plan Modal */}
                {selectedPlanItem && (
                    <OrderPlanModal
                        visible={planModalVisible}
                        onClose={() => setPlanModalVisible(false)}
                        itemName={selectedPlanItem.name}
                        productId={selectedPlanItem.productId}
                        orderQty={selectedPlanItem.qty}
                        productImage={selectedPlanItem.image}
                    />
                )}
            </View>
        </Modal>
    );
};

const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'shipped') return '#2E7D32';
    if (s === 'pending') return '#F9A825';
    if (s === 'ready to ship' || s === 'packed') return '#1565C0';
    if (s === 'cancel' || s === 'cancelled' || s === 'unpaid') return '#C62828';
    return Colors.textSecondary;
};

const getStatusBadgeStyle = (status: string) => {
    const s = status.toLowerCase();
    let bg = Colors.background;
    if (s === 'shipped') bg = '#E8F5E9';
    else if (s === 'pending') bg = '#FFF9C4';
    else if (s === 'ready to ship' || s === 'packed') bg = '#E3F2FD';
    else if (s === 'cancel' || s === 'cancelled' || s === 'unpaid') bg = '#FFEBEE';

    return { backgroundColor: bg };
};

const getStockColorStyle = (stock: any) => {
    if (stock === '-') return { color: Colors.textSecondary };
    const val = parseInt(stock);
    if (isNaN(val)) return { color: Colors.textSecondary };
    if (val > 10) return { color: '#2E7D32' };
    if (val > 0) return { color: '#F9A825' };
    return { color: '#C62828' };
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.background,
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        height: '85%',
        paddingTop: Spacing.md,
        // Outer shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        backgroundColor: Colors.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        // Shadow for header
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 4,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    headerSubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    closeBtn: {
        padding: Spacing.xs,
    },
    scrollContent: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
    },
    section: {
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: Spacing.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
        gap: 8,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: Radius.round,
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    storeText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.xs,
        gap: Spacing.sm,
    },
    infoLabel: {
        fontSize: 14,
        color: Colors.textSecondary,
        width: 80,
    },
    infoValue: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '500',
        flex: 1,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        padding: Spacing.sm,
        borderRadius: Radius.sm,
        marginBottom: Spacing.xs,
    },
    tableHeaderText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.textSecondary,
    },
    tableRow: {
        flexDirection: 'row',
        padding: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    productName: {
        fontSize: 13,
        color: Colors.text,
    },
    productQty: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.text,
    },
    productAmount: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Colors.text,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.md,
        padding: Spacing.sm,
        backgroundColor: Colors.primarySoft,
        borderRadius: Radius.md,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    totalValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    stockSection: {
        borderBottomWidth: 0,
        backgroundColor: '#FAFAFA',
        marginHorizontal: -Spacing.lg,
        paddingHorizontal: Spacing.lg,
        marginTop: Spacing.sm,
    },
    stockGrid: {
        gap: Spacing.sm,
    },
    stockItemCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    stockInfo: {
        flex: 1,
        gap: 4,
    },
    stockProductName: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.text,
    },
    stockBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stockLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    stockValue: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: Radius.round,
        gap: 4,
    },
    addBtnText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    infoNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.md,
        gap: 8,
        padding: Spacing.sm,
        backgroundColor: '#F5F5F5',
        borderRadius: Radius.sm,
    },
    infoNoticeText: {
        fontSize: 11,
        color: Colors.textSecondary,
        flex: 1,
    },
    footer: {
        padding: Spacing.lg,
        backgroundColor: Colors.background,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        alignItems: 'center',
        // Shadow for footer
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 8,
    },
    footerBtn: {
        width: '100%',
        paddingVertical: Spacing.md,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.md,
        alignItems: 'center',
    },
    footerBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
});
