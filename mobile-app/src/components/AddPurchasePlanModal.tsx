import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { X, Calendar, ChevronDown, Search } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { ProductRepo, Product } from '../db/repo';
import { PurchaseRepo } from '../db/purchaseRepo';

interface AddPurchasePlanModalProps {
    visible: boolean;
    onClose: () => void;
    onSave?: (data: any) => Promise<void>;
    initialProduct?: Product | null;
    initialQuantity?: number;
}

export default function AddPurchasePlanModal({
    visible,
    onClose,
    onSave,
    initialProduct,
    initialQuantity = 1
}: AddPurchasePlanModalProps) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [status, setStatus] = useState<'Pending' | 'Complete' | 'Cancel'>('Pending');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [sku, setSku] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [remarks, setRemarks] = useState('');
    const [stats, setStats] = useState({ latestPrice: 0, latestSupplier: '-', lowPrice: 0, lowSupplier: '-' });
    const [products, setProducts] = useState<Product[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showProductList, setShowProductList] = useState(false);
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);

    useEffect(() => {
        if (visible) {
            loadProducts();
            // Reset form
            setDate(new Date().toISOString().split('T')[0]);
            setStatus('Pending');

            if (initialProduct) {
                // If checking for duplicates here, we might want to do it before opening?
                // But let's set it up.
                handleProductSelect(initialProduct);
                setQuantity(initialQuantity.toString());
            } else {
                setSelectedProduct(null);
                setSku('');
                setQuantity('1');
                setRemarks('');
                setStats({ latestPrice: 0, latestSupplier: '-', lowPrice: 0, lowSupplier: '-' });
                setSearchQuery('');
            }

            setShowProductList(false);
            setShowStatusDropdown(false);
        }
    }, [visible, initialProduct]);

    const loadProducts = async () => {
        const data = await ProductRepo.getAll();
        setProducts(data);
    };

    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const handleProductSelect = async (product: Product) => {
        setSelectedProduct(product);
        setSku(product.sku || '');
        setSearchQuery(product.name);
        setShowProductList(false);

        const data = await PurchaseRepo.getSnapshotStats(product.id);
        setStats(data);
    };

    const handleSave = async () => {
        if (!selectedProduct) {
            Alert.alert('Error', 'Please select a product');
            return;
        }
        // Align expiry logic with web dashboard
        let expiresAt: string;
        const now = new Date();
        if (status === 'Pending') {
            expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
        } else if (status === 'Complete') {
            expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
        } else {
            expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
        }

        const planData = {
            id: generateUUID(),
            plan_date: date,
            product_id: selectedProduct.id,
            quantity: parseInt(quantity) || 0,
            remarks: remarks,
            status: status as any,
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
            sync_status: 'pending' as 'pending',
            snapshot_latest_price: stats.latestPrice,
            snapshot_latest_supplier: stats.latestSupplier,
            snapshot_low_price: stats.lowPrice,
            snapshot_low_supplier: stats.lowSupplier,
            cached_product_name: selectedProduct.name,
            cached_product_image: selectedProduct.image_url
        };

        if (onSave) {
            await onSave(planData);
        } else {
            await PurchaseRepo.upsertPlan(planData);
        }

        Alert.alert('Success', 'Add Successful');
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.detailsModalOverlay}>
                <View style={styles.detailsModalContent}>
                    <View style={styles.detailsHeaderSticky}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.detailsTitle}>Add Daily Purchase Plan</Text>
                            <TouchableOpacity onPress={onClose}>
                                <X size={24} color="#4A5568" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView
                        style={styles.modalScrollBody}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        bounces={false}
                    >
                        <View style={styles.modalBodyPadding}>
                            <View style={styles.formRow}>
                                <View style={styles.formField}>
                                    <Text style={styles.detailsLabelBlack}>Date</Text>
                                    <View style={styles.formInputContainer}>
                                        <Text style={styles.formInputText}>{date}</Text>
                                        <Calendar size={18} color="#000000" />
                                    </View>
                                </View>
                                <View style={styles.formField}>
                                    <Text style={styles.detailsLabelBlack}>Status</Text>
                                    <TouchableOpacity
                                        style={styles.formInputContainer}
                                        onPress={() => setShowStatusDropdown(!showStatusDropdown)}
                                    >
                                        <Text style={styles.formInputText}>{status}</Text>
                                        <ChevronDown size={18} color="#000000" />
                                    </TouchableOpacity>

                                    {showStatusDropdown && (
                                        <View style={styles.statusDropdown}>
                                            {['Pending', 'Complete', 'Cancel'].map((s) => (
                                                <TouchableOpacity
                                                    key={s}
                                                    style={styles.dropdownOption}
                                                    onPress={() => {
                                                        setStatus(s as any);
                                                        setShowStatusDropdown(false);
                                                    }}
                                                >
                                                    <Text style={[styles.dropdownOptionText, status === s && { fontWeight: 'bold', color: Colors.primary }]}>
                                                        {s}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View style={styles.formFieldFull}>
                                <Text style={styles.detailsLabelBlack}>Product Name <Text style={{ color: '#E53E3E' }}>*</Text></Text>
                                <View style={styles.formInputContainer}>
                                    <Search size={18} color="#000000" style={{ marginRight: 8 }} />
                                    <TextInput
                                        style={styles.formInputText}
                                        placeholder="Search product..."
                                        placeholderTextColor="#A0AEC0"
                                        value={searchQuery}
                                        onChangeText={(text) => {
                                            setSearchQuery(text);
                                            setShowProductList(true);
                                            if (selectedProduct && text !== selectedProduct.name) {
                                                setSelectedProduct(null);
                                                setSku('');
                                            }
                                        }}
                                        onFocus={() => setShowProductList(true)}
                                    />
                                    <TouchableOpacity onPress={() => setShowProductList(!showProductList)}>
                                        <ChevronDown size={18} color="#000000" />
                                    </TouchableOpacity>
                                </View>

                                {showProductList && (
                                    <View style={styles.productDropdown}>
                                        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled={true}>
                                            {products
                                                .filter(p => !p.product_type || p.product_type === 'single')
                                                .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())))
                                                .map(p => (
                                                    <TouchableOpacity
                                                        key={p.id}
                                                        style={styles.productItem}
                                                        onPress={() => handleProductSelect(p)}
                                                    >
                                                        <Text style={styles.productItemText}>{p.name}</Text>
                                                        <Text style={styles.productItemSku}>{p.sku}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>

                            <View style={styles.formFieldFull}>
                                <Text style={styles.detailsLabelBlack}>Seller SKUs</Text>
                                <View style={[styles.formInputContainer, { backgroundColor: '#F7FAFC' }]}>
                                    <Text style={[styles.formInputText, !sku && { color: '#A0AEC0' }]}>
                                        {sku || 'Auto-filled from product'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={styles.formField}>
                                    <Text style={styles.detailsLabelBlack}>Quantity</Text>
                                    <View style={styles.formInputContainer}>
                                        <TextInput
                                            style={styles.formInputText}
                                            value={quantity}
                                            onChangeText={setQuantity}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>
                                <View style={styles.formField}>
                                    <Text style={styles.detailsLabelBlack}>Remarks</Text>
                                    <View style={styles.formInputContainer}>
                                        <TextInput
                                            style={styles.formInputText}
                                            value={remarks}
                                            onChangeText={setRemarks}
                                            placeholder="Optional"
                                        />
                                    </View>
                                </View>
                            </View>

                            <View style={styles.detailsDivider} />

                            <Text style={styles.sectionTitleSmall}>Purchase History Stats</Text>
                            <View style={styles.statsCard}>
                                <View style={styles.statsRow}>
                                    <View style={styles.statsItem}>
                                        <Text style={styles.statsLabel}>Latest Purchase</Text>
                                        <Text style={styles.statsPrice}>Rs. {stats.latestPrice}</Text>
                                        <Text style={styles.statsSupplier} numberOfLines={1}>{stats.latestSupplier}</Text>
                                    </View>
                                    <View style={styles.statsItem}>
                                        <Text style={styles.statsLabel}>All-Time Low</Text>
                                        <Text style={[styles.statsPrice, { color: '#38A169' }]}>Rs. {stats.lowPrice}</Text>
                                        <Text style={styles.statsSupplier} numberOfLines={1}>{stats.lowSupplier}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    <View style={styles.detailsFooterSticky}>
                        <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
                            <Text style={styles.modalCancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalSaveButton} onPress={handleSave}>
                            <Text style={styles.modalSaveButtonText}>Save Plan</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    detailsModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
    },
    detailsModalContent: {
        width: '94%',
        maxHeight: '90%',
        backgroundColor: '#FFFFFF',
        borderRadius: Radius.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
        overflow: 'hidden',
    },
    detailsHeaderSticky: {
        padding: Spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        zIndex: 10,
        // Enhanced Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 5,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    detailsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D3748',
    },
    modalScrollBody: {
        backgroundColor: '#FFFFFF',
    },
    modalBodyPadding: {
        padding: Spacing.md,
    },
    detailsLabelBlack: {
        fontSize: 14,
        color: '#000000',
        fontWeight: 'bold',
        marginBottom: 6,
    },
    formRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
    },
    formField: {
        flex: 1,
    },
    formFieldFull: {
        width: '100%',
        marginBottom: 16,
    },
    formInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        marginTop: 4,
        backgroundColor: '#FFFFFF',
    },
    formInputText: {
        fontSize: 15,
        color: '#2D3748',
        flex: 1,
    },
    productDropdown: {
        position: 'absolute',
        top: 68,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 2000,
    },
    statusDropdown: {
        position: 'absolute',
        top: 68,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 2000,
    },
    dropdownOption: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F7FAFC',
    },
    dropdownOptionText: {
        fontSize: 15,
        color: '#2D3748',
    },
    productItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F7FAFC',
    },
    productItemText: {
        fontSize: 14,
        color: '#2D3748',
        fontWeight: '500',
    },
    productItemSku: {
        fontSize: 12,
        color: '#718096',
        marginTop: 2,
    },
    detailsDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: Spacing.md,
    },
    sectionTitleSmall: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: Spacing.sm,
    },
    statsCard: {
        backgroundColor: '#F7FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statsItem: {
        flex: 1,
    },
    statsLabel: {
        fontSize: 12,
        color: '#718096',
        marginBottom: 4,
    },
    statsPrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D3748',
    },
    statsSupplier: {
        fontSize: 11,
        color: '#A0AEC0',
        marginTop: 2,
    },
    detailsFooterSticky: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: Spacing.md,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        // Enhanced Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
        elevation: 10,
    },
    modalCancelButton: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
    },
    modalCancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#4A5568',
    },
    modalSaveButton: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: '#2563EB',
        borderRadius: 8,
    },
    modalSaveButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
