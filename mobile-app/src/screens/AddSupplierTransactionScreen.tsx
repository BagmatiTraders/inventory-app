import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Calendar, ChevronDown, Check, ArrowLeft } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDataStore } from '../store/useDataStore';
import { SupplierTransaction } from '../db/supplierRepo';
import { v4 as uuidv4 } from 'uuid';

export default function AddSupplierTransactionScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { addSupplierTransaction } = useDataStore();
    const insets = useSafeAreaInsets();

    const { supplierId, supplierName } = route.params || {};

    const [loading, setLoading] = useState(false);

    // Form State
    const [date, setDate] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [transactionType, setTransactionType] = useState<'Paid' | 'Received'>('Paid');
    const [transactionMode, setTransactionMode] = useState<'Cash' | 'Cheque' | 'Online Payment'>('Cash');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [chequeDate, setChequeDate] = useState('');
    const [amount, setAmount] = useState('');
    const [remarks, setRemarks] = useState('');

    // Dropdown Visibility
    const [typeDropdownVisible, setTypeDropdownVisible] = useState(false);
    const [modeDropdownVisible, setModeDropdownVisible] = useState(false);
    const [methodDropdownVisible, setMethodDropdownVisible] = useState(false);

    // Logic for Payment Method based on Transaction Mode
    useEffect(() => {
        if (transactionMode === 'Cash') {
            setPaymentMethod('Cash');
            setChequeDate('');
        } else if (transactionMode === 'Cheque') {
            setPaymentMethod('BTAS Global');
        } else if (transactionMode === 'Online Payment') {
            setPaymentMethod('Bank Transfer');
            setChequeDate('');
        }
    }, [transactionMode]);

    const getPaymentMethods = () => {
        if (transactionMode === 'Cash') return ['Cash'];
        if (transactionMode === 'Cheque') return ['BTAS Global', 'BTAS Nbl', 'Others'];
        if (transactionMode === 'Online Payment') return ['Bank Transfer', 'Esewa', 'Khalti', 'Others'];
        return [];
    };

    const handleSave = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount.');
            return;
        }

        if (transactionMode === 'Cheque' && !chequeDate) {
            Alert.alert('Missing Info', 'Cheque Date is required for Cheque transactions.');
            return;
        }

        setLoading(true);
        try {
            const transaction: SupplierTransaction = {
                id: uuidv4(), // Using proper UUID v4
                transaction_date: date,
                supplier_id: supplierId,
                transaction_mode: transactionMode,
                transaction_type: transactionType,
                amount: parseFloat(amount),
                payment_method: paymentMethod,
                cheque_date: transactionMode === 'Cheque' ? chequeDate : null,
                remarks: remarks,
                sync_status: 'pending'
            };

            await addSupplierTransaction(transaction);
            Alert.alert('Success', 'Transaction saved successfully!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error: any) {
            console.error('Save failed:', error);
            const errorMessage = error?.message || 'Failed to save transaction. Please check your connection and try again.';
            Alert.alert('Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header with Shadow */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add New Transaction</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flex}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Supplier Info */}
                    <View style={styles.supplierCard}>
                        <Text style={styles.supplierLabel}>Supplier</Text>
                        <Text style={styles.supplierName}>{supplierName}</Text>
                    </View>

                    {/* Form Fields */}
                    <View style={styles.formSection}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Date</Text>
                            <View style={styles.inputContainer}>
                                <Calendar size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    value={date}
                                    onChangeText={setDate}
                                    placeholder="YYYY-MM-DD"
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={styles.halfInput}>
                                <Text style={styles.label}>Transaction Type</Text>
                                <TouchableOpacity
                                    style={styles.pickerTrigger}
                                    onPress={() => setTypeDropdownVisible(!typeDropdownVisible)}
                                >
                                    <Text style={styles.pickerValue}>{transactionType}</Text>
                                    <ChevronDown size={18} color={Colors.textSecondary} />
                                </TouchableOpacity>
                                {typeDropdownVisible && (
                                    <View style={styles.dropdown}>
                                        {['Paid', 'Received'].map((item) => (
                                            <TouchableOpacity
                                                key={item}
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                    setTransactionType(item as any);
                                                    setTypeDropdownVisible(false);
                                                }}
                                            >
                                                <Text style={[styles.dropdownText, transactionType === item && styles.selectedText]}>{item}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <View style={styles.halfInput}>
                                <Text style={styles.label}>Amount</Text>
                                <View style={styles.inputContainer}>
                                    <Text style={styles.currencyPrefix}>रु</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={amount}
                                        onChangeText={setAmount}
                                        keyboardType="numeric"
                                        placeholder="0.00"
                                    />
                                </View>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Transaction Mode</Text>
                            <TouchableOpacity
                                style={styles.pickerTrigger}
                                onPress={() => setModeDropdownVisible(!modeDropdownVisible)}
                            >
                                <Text style={styles.pickerValue}>{transactionMode}</Text>
                                <ChevronDown size={18} color={Colors.textSecondary} />
                            </TouchableOpacity>
                            {modeDropdownVisible && (
                                <View style={styles.dropdown}>
                                    {['Cash', 'Cheque', 'Online Payment'].map((item) => (
                                        <TouchableOpacity
                                            key={item}
                                            style={styles.dropdownItem}
                                            onPress={() => {
                                                setTransactionMode(item as any);
                                                setModeDropdownVisible(false);
                                            }}
                                        >
                                            <Text style={[styles.dropdownText, transactionMode === item && styles.selectedText]}>{item}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Payment Method</Text>
                            <TouchableOpacity
                                style={styles.pickerTrigger}
                                onPress={() => setMethodDropdownVisible(!methodDropdownVisible)}
                            >
                                <Text style={styles.pickerValue}>{paymentMethod}</Text>
                                <ChevronDown size={18} color={Colors.textSecondary} />
                            </TouchableOpacity>
                            {methodDropdownVisible && (
                                <View style={styles.dropdown}>
                                    {getPaymentMethods().map((item) => (
                                        <TouchableOpacity
                                            key={item}
                                            style={styles.dropdownItem}
                                            onPress={() => {
                                                setPaymentMethod(item);
                                                setMethodDropdownVisible(false);
                                            }}
                                        >
                                            <Text style={[styles.dropdownText, paymentMethod === item && styles.selectedText]}>{item}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        {transactionMode === 'Cheque' && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Cheque Date</Text>
                                <View style={styles.inputContainer}>
                                    <Calendar size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        value={chequeDate}
                                        onChangeText={setChequeDate}
                                        placeholder="YYYY-MM-DD"
                                    />
                                </View>
                            </View>
                        )}

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
                    </View>
                </ScrollView>

                {/* Footer with Shadow */}
                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                <Check size={20} color="#FFF" style={styles.buttonIcon} />
                                <Text style={styles.saveButtonText}>Save Transaction</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    flex: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: '#FFF',
        // Shadow Effect
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 10,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    scrollContent: {
        padding: Spacing.md,
        paddingBottom: 100,
    },
    supplierCard: {
        backgroundColor: Colors.primarySoft,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        marginBottom: Spacing.lg,
    },
    supplierLabel: {
        fontSize: 12,
        color: Colors.primary,
        fontWeight: '600',
        marginBottom: 4,
    },
    supplierName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    formSection: {
        gap: Spacing.md,
    },
    inputGroup: {
        marginBottom: 4,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F7FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: Radius.md,
        paddingHorizontal: 12,
        height: 50,
    },
    inputIcon: {
        marginRight: 10,
    },
    currencyPrefix: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: Colors.text,
    },
    inputBox: {
        backgroundColor: '#F7FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: Radius.md,
        paddingHorizontal: 12,
        fontSize: 16,
        color: Colors.text,
        minHeight: 50,
    },
    textArea: {
        height: 100,
        paddingTop: 12,
    },
    row: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    halfInput: {
        flex: 1,
    },
    pickerTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F7FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: Radius.md,
        paddingHorizontal: 12,
        height: 50,
    },
    pickerValue: {
        fontSize: 16,
        color: Colors.text,
    },
    dropdown: {
        position: 'absolute',
        top: 80,
        left: 0,
        right: 0,
        backgroundColor: '#FFF',
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 10,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    dropdownItem: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F7FAFC',
    },
    dropdownText: {
        fontSize: 15,
        color: Colors.text,
    },
    selectedText: {
        color: Colors.primary,
        fontWeight: 'bold',
    },
    footer: {
        padding: Spacing.md,
        backgroundColor: '#FFF',
        // Shadow Effect
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 10,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        height: 54,
        borderRadius: Radius.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    buttonIcon: {
        marginTop: 1,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFF',
    },
});
