import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { X, Plus, Trash2, ChevronDown, Package } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { useDataStore } from '../store/useDataStore';
import SearchablePicker from '../components/SearchablePicker';

interface AddProductModalProps {
    visible: boolean;
    onClose: () => void;
}

interface ComboItem {
    child_product_id: string;
    child_product_name: string;
    quantity: number;
}

interface SellerData {
    sku: string;
    account: string;
}

export default function AddProductModal({ visible, onClose }: AddProductModalProps) {
    const { products, addProduct } = useDataStore();
    const [loading, setLoading] = useState(false);

    // Form State
    const [productName, setProductName] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [productType, setProductType] = useState<'single' | 'combo'>('single');

    // Seller SKUs & Accounts
    const [sellerData, setSellerData] = useState<Record<number, SellerData>>({
        1: { sku: '', account: '' },
        2: { sku: '', account: '' },
        3: { sku: '', account: '' },
        4: { sku: '', account: '' },
    });

    const updateSellerData = (num: number, field: keyof SellerData, value: string) => {
        setSellerData(prev => ({
            ...prev,
            [num]: { ...prev[num], [field]: value }
        }));
    };

    // Combo Items
    const [comboItems, setComboItems] = useState<ComboItem[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [comboQty, setComboQty] = useState('1');
    const [productPickerVisible, setProductPickerVisible] = useState(false);

    const resetForm = () => {
        setProductName('');
        setImageUrl('');
        setProductType('single');
        setSellerData({
            1: { sku: '', account: '' },
            2: { sku: '', account: '' },
            3: { sku: '', account: '' },
            4: { sku: '', account: '' },
        });
        setComboItems([]);
        setSelectedProduct(null);
        setComboQty('1');
    };

    useEffect(() => {
        if (visible) {
            resetForm();
        }
    }, [visible]);

    const handleAddComboItem = () => {
        if (!selectedProduct) {
            Alert.alert('Error', 'Please select a product');
            return;
        }
        const qty = parseInt(comboQty);
        if (isNaN(qty) || qty <= 0) {
            Alert.alert('Error', 'Please enter a valid quantity');
            return;
        }

        if (comboItems.some(item => item.child_product_id === selectedProduct.id)) {
            Alert.alert('Error', 'This product is already in the combo');
            return;
        }

        setComboItems([
            ...comboItems,
            {
                child_product_id: selectedProduct.id,
                child_product_name: selectedProduct.name,
                quantity: qty,
            }
        ]);
        setSelectedProduct(null);
        setComboQty('1');
    };

    const handleRemoveComboItem = (id: string) => {
        setComboItems(comboItems.filter(item => item.child_product_id !== id));
    };

    const handleSave = async () => {
        if (!productName.trim()) {
            Alert.alert('Error', 'Product name is required');
            return;
        }

        if (productType === 'combo' && comboItems.length === 0) {
            Alert.alert('Error', 'Combo products must have at least one component');
            return;
        }

        setLoading(true);
        try {
            await addProduct({
                product_name: productName.trim(),
                image_url: imageUrl.trim(),
                product_type: productType,
                seller_sku1: sellerData[1].sku,
                seller_account1: sellerData[1].account,
                seller_sku2: sellerData[2].sku,
                seller_account2: sellerData[2].account,
                seller_sku3: sellerData[3].sku,
                seller_account3: sellerData[3].account,
                seller_sku4: sellerData[4].sku,
                seller_account4: sellerData[4].account,
                combo_items: productType === 'combo' ? comboItems : undefined,
            });

            Alert.alert('Success', 'Add Successful');
            onClose();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to add product');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalContainer}
            >
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Package size={24} color={Colors.primary} />
                            <Text style={styles.headerTitle}>Add New Product</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.form}
                        contentContainerStyle={styles.formScroll}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Basic Info */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Basic Information</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Product Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={productName}
                                    onChangeText={setProductName}
                                    placeholder="Enter product name"
                                    placeholderTextColor={Colors.textSecondary}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Image URL</Text>
                                <TextInput
                                    style={styles.input}
                                    value={imageUrl}
                                    onChangeText={setImageUrl}
                                    placeholder="https://example.com/image.jpg"
                                    placeholderTextColor={Colors.textSecondary}
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Product Type</Text>
                                <View style={styles.typeSelector}>
                                    <TouchableOpacity
                                        style={[
                                            styles.typeButton,
                                            productType === 'single' && styles.typeButtonActive
                                        ]}
                                        onPress={() => setProductType('single')}
                                    >
                                        <Text style={[
                                            styles.typeButtonText,
                                            productType === 'single' && styles.typeButtonTextActive
                                        ]}>Single</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.typeButton,
                                            productType === 'combo' && styles.typeButtonActive
                                        ]}
                                        onPress={() => setProductType('combo')}
                                    >
                                        <Text style={[
                                            styles.typeButtonText,
                                            productType === 'combo' && styles.typeButtonTextActive
                                        ]}>Combo</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* Combo Components */}
                        {productType === 'combo' && (
                            <View style={[styles.section, styles.comboSection]}>
                                <Text style={styles.sectionTitle}>Combo Components</Text>

                                <View style={styles.comboInputRow}>
                                    <TouchableOpacity
                                        style={[styles.input, styles.comboProductPicker]}
                                        onPress={() => setProductPickerVisible(true)}
                                    >
                                        <Text style={selectedProduct ? styles.inputText : styles.placeholderText}>
                                            {selectedProduct ? selectedProduct.name : 'Select Product'}
                                        </Text>
                                        <ChevronDown size={20} color={Colors.textSecondary} />
                                    </TouchableOpacity>

                                    <TextInput
                                        style={[styles.input, styles.comboQtyInput]}
                                        value={comboQty}
                                        onChangeText={setComboQty}
                                        keyboardType="numeric"
                                        placeholder="Qty"
                                        placeholderTextColor={Colors.textSecondary}
                                    />

                                    <TouchableOpacity style={styles.addButton} onPress={handleAddComboItem}>
                                        <Plus size={24} color="#FFF" />
                                    </TouchableOpacity>
                                </View>

                                {comboItems.map((item) => (
                                    <View key={item.child_product_id} style={styles.comboItem}>
                                        <Text style={styles.comboItemText}>{item.child_product_name} × {item.quantity}</Text>
                                        <TouchableOpacity onPress={() => handleRemoveComboItem(item.child_product_id)}>
                                            <Trash2 size={18} color={Colors.danger} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Seller SKUs */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Seller SKUs & Accounts</Text>

                            {[1, 2, 3, 4].map((num) => (
                                <View key={num} style={styles.skuRow}>
                                    <View style={[styles.inputGroup, { flex: 1 }]}>
                                        <Text style={styles.label}>SKU {num}</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={sellerData[num].sku}
                                            onChangeText={(text) => updateSellerData(num, 'sku', text)}
                                            placeholder="SKU"
                                            placeholderTextColor={Colors.textSecondary}
                                        />
                                    </View>
                                    <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.sm }]}>
                                        <Text style={styles.label}>Account {num}</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={sellerData[num].account}
                                            onChangeText={(text) => updateSellerData(num, 'account', text)}
                                            placeholder="Account"
                                            placeholderTextColor={Colors.textSecondary}
                                        />
                                    </View>
                                </View>
                            ))}
                        </View>

                        <View style={{ height: 100 }} />
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.footerButton, styles.cancelButton]}
                            onPress={onClose}
                            disabled={loading}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.footerButton, styles.saveButton]}
                            onPress={handleSave}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <>
                                    <Text style={styles.saveButtonText}>Save Product</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Product Picker for Combo */}
                <SearchablePicker
                    visible={productPickerVisible}
                    onClose={() => setProductPickerVisible(false)}
                    items={products}
                    onSelect={setSelectedProduct}
                    placeholder="Search products..."
                    title="Select Product"
                    selectedId={selectedProduct?.id}
                />
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        height: '92%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        // Aligned Shadow with AddPurchaseModal
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 4,
        zIndex: 10,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    closeButton: {
        padding: 4,
    },
    form: {
        flex: 1,
    },
    formScroll: {
        padding: Spacing.md,
        paddingBottom: 100,
    },
    section: {
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: Spacing.md,
        opacity: 0.8,
    },
    inputGroup: {
        marginBottom: Spacing.md,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.textSecondary,
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: Radius.md,
        paddingHorizontal: 12,
        height: 48,
        fontSize: 15,
        color: Colors.text,
    },
    inputText: {
        fontSize: 15,
        color: Colors.text,
    },
    placeholderText: {
        fontSize: 15,
        color: Colors.textSecondary,
    },
    typeSelector: {
        flexDirection: 'row',
        backgroundColor: '#F1F3F5',
        borderRadius: Radius.md,
        padding: 4,
    },
    typeButton: {
        flex: 1,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: Radius.sm,
    },
    typeButtonActive: {
        backgroundColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    typeButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.textSecondary,
    },
    typeButtonTextActive: {
        color: Colors.primary,
        fontWeight: 'bold',
    },
    comboSection: {
        backgroundColor: '#F0F7FF',
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: '#CCE4FF',
    },
    comboInputRow: {
        flexDirection: 'row',
        gap: Spacing.xs,
        marginBottom: Spacing.md,
    },
    comboProductPicker: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF',
    },
    comboQtyInput: {
        width: 60,
        textAlign: 'center',
        backgroundColor: '#FFF',
    },
    addButton: {
        width: 48,
        height: 48,
        backgroundColor: Colors.primary,
        borderRadius: Radius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    comboItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: Radius.md,
        marginBottom: Spacing.xs,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    comboItemText: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '500',
    },
    skuRow: {
        flexDirection: 'row',
        marginBottom: Spacing.xs,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        padding: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        gap: Spacing.md,
        backgroundColor: '#F8F9FA',
        // Aligned Shadow with AddPurchaseModal
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 8,
    },
    footerButton: {
        flex: 1,
        height: 52,
        borderRadius: Radius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F1F3F5',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.textSecondary,
    },
    saveButton: {
        backgroundColor: Colors.primary,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFF',
    },
});
