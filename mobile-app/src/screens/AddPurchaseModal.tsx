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
import { X, Calendar, ChevronDown, Save } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { useDataStore } from '../store/useDataStore';
import SearchablePicker from '../components/SearchablePicker';
import { PurchaseRepo, Purchase, PurchasePlan } from '../db/purchaseRepo';

interface AddPurchaseModalProps {
    visible: boolean;
    onClose: () => void;
    editPurchase?: Purchase | null;
    planData?: PurchasePlan | null;
    defaultSupplierId?: string;
    defaultSupplierName?: string;
}

export default function AddPurchaseModal({ visible, onClose, editPurchase, planData, defaultSupplierId, defaultSupplierName }: AddPurchaseModalProps) {
    const { products, suppliers, addPurchase, updatePurchase } = useDataStore();
    const [loading, setLoading] = useState(false);

    // Form State
    const [date, setDate] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [purchaseType, setPurchaseType] = useState<'Buy' | 'Sell'>('Buy');
    const [productId, setProductId] = useState('');
    const [productName, setProductName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unitAmount, setUnitAmount] = useState('');
    const [totalAmount, setTotalAmount] = useState('0');
    const [supplierId, setSupplierId] = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [paymentType, setPaymentType] = useState('Cash');
    const [remarks, setRemarks] = useState('');

    // Picker Visibility
    const [productPickerVisible, setProductPickerVisible] = useState(false);
    const [supplierPickerVisible, setSupplierPickerVisible] = useState(false);
    const [purchaseTypeDropdownVisible, setPurchaseTypeDropdownVisible] = useState(false);

    // Calculate total amount
    useEffect(() => {
        const qty = parseFloat(quantity) || 0;
        const rate = parseFloat(unitAmount) || 0;
        setTotalAmount((qty * rate).toFixed(2));
    }, [quantity, unitAmount]);

    // Handle Edit Mode Initial State
    useEffect(() => {
        if (visible) {
            if (editPurchase) {
                setDate(editPurchase.purchase_date);
                setPurchaseType(editPurchase.purchase_type as 'Buy' | 'Sell' || 'Buy');
                setProductId(editPurchase.product_id);
                setProductName(editPurchase.product?.product_name || '');
                setQuantity(editPurchase.quantity.toString());
                setUnitAmount(editPurchase.unit_amount.toString());
                setTotalAmount(editPurchase.total_amount.toString());
                setSupplierId(editPurchase.supplier_id);
                setSupplierName(editPurchase.supplier?.supplier_name || '');
                setPaymentType(editPurchase.payment_type || 'Cash');
                setRemarks(editPurchase.remarks || '');
            } else if (planData) {
                resetForm();
                setProductName(planData.product?.product_name || planData.cached_product_name || '');
                setProductId(planData.product_id);
                setQuantity(planData.quantity.toString());
                setRemarks(planData.remarks || '');
                // Try to auto-set rate if snapshot exists
                if (planData.snapshot_latest_price) {
                    setUnitAmount(planData.snapshot_latest_price.toString());
                }
            } else if (defaultSupplierId && defaultSupplierName) {
                resetForm();
                setSupplierId(defaultSupplierId);
                setSupplierName(defaultSupplierName);
            } else {
                resetForm();
            }
        }
    }, [visible, editPurchase, planData, defaultSupplierId, defaultSupplierName]);

    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const handleSave = async () => {
        if (!productId || !supplierId || !quantity || !unitAmount) {
            Alert.alert('Missing Info', 'Please fill in all required fields (Product, Supplier, Quantity, Amount)');
            return;
        }

        setLoading(true);
        try {
            const purchaseData: Purchase = {
                id: editPurchase ? editPurchase.id : generateUUID(),
                purchase_date: date,
                product_id: productId,
                supplier_id: supplierId,
                quantity: parseFloat(quantity),
                unit_amount: parseFloat(unitAmount),
                total_amount: parseFloat(totalAmount),
                payment_type: paymentType,
                remarks: remarks,
                purchase_type: purchaseType,
                sync_status: 'pending'
            };

            if (editPurchase) {
                await updatePurchase(purchaseData);
                Alert.alert('Success', 'Add Successful');
                onClose();
            } else {
                await addPurchase(purchaseData);
                Alert.alert('Success', 'Add Successful');
                onClose();
            }
        } catch (error) {
            console.error('Save failed:', error);
            Alert.alert('Error', 'Failed to save purchase. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setProductId('');
        setProductName('');
        setQuantity('');
        setUnitAmount('');
        setTotalAmount('0'); // Reset totalAmount to '0' string
        setSupplierId('');
        setSupplierName('');
        setPaymentType('Cash');
        setRemarks('');
        setPurchaseType('Buy');
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{editPurchase ? 'Edit Purchase' : 'Add Purchase'}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={24} color={Colors.text} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.formScroll}>
                    <View style={styles.row}>
                        <View style={styles.halfInput}>
                            <Text style={styles.label}>Date</Text>
                            <View style={styles.inputWrapper}>
                                <Calendar size={18} color={Colors.textSecondary} style={styles.icon} />
                                <TextInput
                                    style={styles.input}
                                    value={date}
                                    onChangeText={setDate}
                                    placeholder="YYYY-MM-DD"
                                />
                            </View>
                        </View>
                        <View style={[styles.halfInput, { zIndex: 20 }]}>
                            <Text style={styles.label}>Purchase Type</Text>
                            <TouchableOpacity
                                style={styles.dropdownTrigger}
                                onPress={() => setPurchaseTypeDropdownVisible(!purchaseTypeDropdownVisible)}
                            >
                                <Text style={styles.dropdownText}>{purchaseType}</Text>
                                <ChevronDown size={20} color={Colors.textSecondary} />
                            </TouchableOpacity>

                            {purchaseTypeDropdownVisible && (
                                <View style={styles.inlineDropdown}>
                                    <TouchableOpacity
                                        style={styles.inlineDropdownItem}
                                        onPress={() => {
                                            setPurchaseType('Buy');
                                            setPurchaseTypeDropdownVisible(false);
                                        }}
                                    >
                                        <Text style={[styles.inlineDropdownText, purchaseType === 'Buy' && styles.selectedInlineText]}>Buy</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.inlineDropdownItem, { borderBottomWidth: 0 }]}
                                        onPress={() => {
                                            setPurchaseType('Sell');
                                            setPurchaseTypeDropdownVisible(false);
                                        }}
                                    >
                                        <Text style={[styles.inlineDropdownText, purchaseType === 'Sell' && styles.selectedInlineText]}>Sell</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Product Name <Text style={styles.required}>*</Text></Text>
                        <TouchableOpacity
                            style={styles.dropdownTrigger}
                            onPress={() => setProductPickerVisible(true)}
                        >
                            <Text style={[styles.dropdownText, !productName && styles.placeholder]}>
                                {productName || 'Search product...'}
                            </Text>
                            <ChevronDown size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.halfInput}>
                            <Text style={styles.label}>Quantity <Text style={styles.required}>*</Text></Text>
                            <TextInput
                                style={styles.inputBox}
                                value={quantity}
                                onChangeText={setQuantity}
                                keyboardType="numeric"
                                placeholder="Qty"
                            />
                        </View>
                        <View style={styles.halfInput}>
                            <Text style={styles.label}>Unit Amount <Text style={styles.required}>*</Text></Text>
                            <TextInput
                                style={styles.inputBox}
                                value={unitAmount}
                                onChangeText={setUnitAmount}
                                keyboardType="numeric"
                                placeholder="Amount"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Total Amount</Text>
                        <View style={styles.totalBox}>
                            <Text style={styles.totalText}>Rs {totalAmount}</Text>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Supplier <Text style={styles.required}>*</Text></Text>
                        <TouchableOpacity
                            style={styles.dropdownTrigger}
                            onPress={() => setSupplierPickerVisible(true)}
                        >
                            <Text style={[styles.dropdownText, !supplierName && styles.placeholder]}>
                                {supplierName || 'Select supplier...'}
                            </Text>
                            <ChevronDown size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.inputGroup, { marginBottom: 20 }]}>
                        <Text style={styles.label}>Payment Type <Text style={styles.required}>*</Text></Text>
                        <View style={styles.paymentSelector}>
                            {['Cash', 'Due', 'Online', 'Other'].map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.paymentBtn, paymentType === type && styles.activePayment]}
                                    onPress={() => setPaymentType(type)}
                                >
                                    <Text style={[styles.paymentBtnText, paymentType === type && styles.activePaymentText]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Remarks</Text>
                        <TextInput
                            style={[styles.inputBox, styles.textArea]}
                            value={remarks}
                            onChangeText={setRemarks}
                            placeholder="Optional remarks..."
                            multiline
                            numberOfLines={3}
                        />
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <>
                                <Save size={18} color="#FFFFFF" strokeWidth={2.5} />
                                <Text style={styles.saveBtnText}>{editPurchase ? 'Update Purchase' : 'Save And Close'}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Searchable Pickers */}

                <SearchablePicker
                    visible={productPickerVisible}
                    onClose={() => setProductPickerVisible(false)}
                    onSelect={(item) => {
                        setProductId(item.id);
                        setProductName(item.name);
                    }}
                    items={products
                        .filter(p => !p.product_type || p.product_type === 'single')
                        .map(p => ({ id: p.id, name: p.name }))}
                    title="Select Product"
                    placeholder="Search product..."
                    selectedId={productId}
                />

                <SearchablePicker
                    visible={supplierPickerVisible}
                    onClose={() => setSupplierPickerVisible(false)}
                    onSelect={(item) => {
                        setSupplierId(item.id);
                        setSupplierName(item.name);
                    }}
                    items={suppliers.map(s => ({ id: s.id, name: s.supplier_name }))}
                    title="Select Supplier"
                    placeholder="Search supplier..."
                    selectedId={supplierId}
                />
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        paddingTop: Platform.OS === 'ios' ? 20 : Spacing.md,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
        // Shadow for header
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 4,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
    },
    closeButton: {
        padding: 4,
    },
    formScroll: {
        padding: Spacing.md,
        paddingBottom: 100,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 12,
    },
    halfInput: {
        flex: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 8,
    },
    required: {
        color: Colors.danger,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#CBD5E0',
        borderRadius: Radius.md,
        paddingHorizontal: 12,
        height: 48,
        backgroundColor: '#FFFFFF',
    },
    icon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: Colors.text,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputBox: {
        borderWidth: 1,
        borderColor: '#CBD5E0',
        borderRadius: Radius.md,
        paddingHorizontal: 12,
        height: 48,
        fontSize: 15,
        color: Colors.text,
        backgroundColor: '#FFFFFF',
    },
    dropdownTrigger: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#CBD5E0',
        borderRadius: Radius.md,
        paddingHorizontal: 12,
        height: 48,
        backgroundColor: '#FFFFFF',
    },
    dropdownText: {
        fontSize: 15,
        color: Colors.text,
    },
    placeholder: {
        color: '#A0AEC0',
    },
    totalBox: {
        backgroundColor: '#EDF2F7',
        borderRadius: Radius.md,
        paddingHorizontal: 12,
        height: 48,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#CBD5E0',
    },
    totalText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#4A5568',
    },
    paymentSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    paymentBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: '#CBD5E0',
        backgroundColor: '#FFFFFF',
    },
    activePayment: {
        borderColor: Colors.warning,
        backgroundColor: '#FFFBEB',
    },
    paymentBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    activePaymentText: {
        color: Colors.text,
    },
    textArea: {
        height: 80,
        paddingTop: 12,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: '#F8F9FA',
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        gap: 12,
        // Shadow for footer
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 8,
    },
    cancelBtn: {
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    cancelBtnText: {
        fontSize: 16,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2563EB', // Blue from image
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    saveBtnText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    inlineDropdown: {
        position: 'absolute',
        top: 75,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: '#CBD5E0',
        elevation: 10,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    inlineDropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F3F5',
    },
    inlineDropdownText: {
        fontSize: 15,
        color: Colors.text,
    },
    selectedInlineText: {
        color: Colors.primary,
        fontWeight: 'bold',
    },
});
