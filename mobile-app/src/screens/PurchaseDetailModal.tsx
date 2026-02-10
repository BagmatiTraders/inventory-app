import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform
} from 'react-native';
import { X, Trash2, Edit3, ShoppingBag, User, CreditCard, Calendar, Info } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { Purchase } from '../db/purchaseRepo';
import { useDataStore } from '../store/useDataStore';

interface PurchaseDetailModalProps {
    visible: boolean;
    onClose: () => void;
    purchase: Purchase | null;
    onEdit: (purchase: Purchase) => void;
}

export default function PurchaseDetailModal({ visible, onClose, purchase, onEdit }: PurchaseDetailModalProps) {
    const { deletePurchase } = useDataStore();

    if (!purchase) return null;

    const handleDelete = () => {
        Alert.alert(
            'Delete Purchase',
            'Are you sure you want to delete this purchase entry? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await deletePurchase(purchase.id);
                        onClose();
                    }
                },
            ]
        );
    };

    const DetailRow = ({ icon: Icon, label, value, color = Colors.text }: any) => (
        <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
                <Icon size={20} color={Colors.textSecondary} />
            </View>
            <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={[styles.detailValue, { color }]}>{value}</Text>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} animationType="fade" transparent={true}>
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>Purchase Details</Text>
                            <View style={[styles.badge, purchase.purchase_type === 'Sell' ? styles.sellBadge : styles.buyBadge]}>
                                <Text style={[styles.badgeText, purchase.purchase_type === 'Sell' ? styles.sellText : styles.buyText]}>
                                    {purchase.purchase_type || 'Buy'}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={Colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.mainInfo}>
                            <Text style={styles.productName}>{purchase.product?.product_name || 'Unknown Product'}</Text>
                            <Text style={styles.totalAmount}>Rs {purchase.total_amount?.toLocaleString()}</Text>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.detailsGrid}>
                            <DetailRow
                                icon={Calendar}
                                label="Date"
                                value={purchase.purchase_date}
                            />
                            <DetailRow
                                icon={User}
                                label="Supplier"
                                value={purchase.supplier?.supplier_name || 'N/A'}
                            />
                            <DetailRow
                                icon={ShoppingBag}
                                label="Quantity / Rate"
                                value={`${purchase.quantity} @ Rs ${purchase.unit_amount?.toLocaleString()}`}
                            />
                            <DetailRow
                                icon={CreditCard}
                                label="Payment Method"
                                value={purchase.payment_type || 'Cash'}
                            />
                            {purchase.remarks && (
                                <DetailRow
                                    icon={Info}
                                    label="Remarks"
                                    value={purchase.remarks}
                                />
                            )}
                        </View>
                    </ScrollView>

                    {/* Footer Actions */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.footerBtn, styles.deleteBtn]}
                            onPress={handleDelete}
                        >
                            <Trash2 size={20} color={Colors.danger} />
                            <Text style={[styles.footerBtnText, styles.deleteBtnText]}>Delete</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.footerBtn, styles.editBtn]}
                            onPress={() => onEdit(purchase)}
                        >
                            <Edit3 size={20} color="#FFFFFF" />
                            <Text style={[styles.footerBtnText, styles.editBtnText]}>Edit Entry</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)', // Darker overlay for better focus
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    modalContainer: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: Radius.lg,
        overflow: 'hidden',
        maxHeight: '80%',
        // Modal Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F3F5',
        // Header Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2, // More prominent shadow
        shadowRadius: 5,
        elevation: 10,
        zIndex: 10,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    closeButton: {
        padding: 4,
    },
    scrollContent: {
        padding: Spacing.lg,
        paddingBottom: 100, // Significantly more space to ensure visibility
    },
    mainInfo: {
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    productName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    totalAmount: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.success,
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F3F5',
        marginBottom: Spacing.lg,
    },
    detailsGrid: {
        gap: 20,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: Radius.md,
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailContent: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: Radius.round,
    },
    buyBadge: {
        backgroundColor: Colors.primarySoft,
    },
    sellBadge: {
        backgroundColor: Colors.warningSoft,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    buyText: {
        color: Colors.info,
    },
    sellText: {
        color: Colors.warning,
    },
    footer: {
        flexDirection: 'row',
        padding: Spacing.md,
        backgroundColor: '#F8F9FA',
        borderTopWidth: 1,
        borderTopColor: '#F1F3F5',
        gap: 12,
        // Footer Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.2, // More prominent shadow
        shadowRadius: 5,
        elevation: 15,
    },
    footerBtn: {
        flex: 1,
        flexDirection: 'row',
        height: 48,
        borderRadius: Radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    deleteBtn: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: Colors.danger,
    },
    editBtn: {
        backgroundColor: Colors.primary,
    },
    footerBtnText: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    deleteBtnText: {
        color: Colors.danger,
    },
    editBtnText: {
        color: '#FFFFFF',
    },
});
