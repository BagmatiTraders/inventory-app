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
    BackHandler,
} from 'react-native';
import { X, Receipt, Save, Calendar, ChevronDown } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { ExpenseRepo, ExpenseCategories, VehicleItems, OfficeItems, type Expense } from '../db/expenseRepo';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values';
import { NotificationHelper } from '../utils/notificationHelper';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AddExpenseModalProps {
    visible: boolean;
    onClose: () => void;
    expense?: Expense;
    userId: string;
    onSuccess?: () => void;
}

export default function AddExpenseModal({ visible, onClose, expense, userId, onSuccess }: AddExpenseModalProps) {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);
    const isEditMode = !!expense;

    // Form State
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [category, setCategory] = useState<string>(ExpenseCategories.VEHICLE);
    const [expenseItem, setExpenseItem] = useState('');
    const [amount, setAmount] = useState('');
    const [remarks, setRemarks] = useState('');

    const resetForm = () => {
        setDate(new Date());
        setCategory(ExpenseCategories.VEHICLE);
        setExpenseItem('');
        setAmount('');
        setRemarks('');
    };

    useEffect(() => {
        if (visible) {
            if (expense) {
                setDate(new Date(expense.date));
                setCategory(expense.category);
                setExpenseItem(expense.expense_item);
                setAmount(expense.amount.toString());
                setRemarks(expense.remarks || '');
            } else {
                resetForm();
            }
        }
    }, [visible, expense]);

    // Handle Android back button
    useEffect(() => {
        if (!visible) return;

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            onClose();
            return true; // Prevent default behavior
        });

        return () => backHandler.remove();
    }, [visible, onClose]);

    // Track if form has unsaved changes
    const hasUnsavedChanges = () => {
        if (isEditMode) return false; // Don't show alert in edit mode
        return expenseItem.trim() !== '' || amount.trim() !== '' || remarks.trim() !== '';
    };

    const handleClose = () => {
        if (hasUnsavedChanges()) {
            Alert.alert(
                'Unsaved Changes',
                'Are you sure you want to cancel? Your changes will be lost.',
                [
                    { text: 'Continue Editing', style: 'cancel' },
                    { text: 'Discard', style: 'destructive', onPress: onClose }
                ]
            );
        } else {
            onClose();
        }
    };

    const getItemOptions = () => {
        if (category === ExpenseCategories.VEHICLE) return VehicleItems;
        if (category === ExpenseCategories.OFFICE) return OfficeItems;
        return [];
    };

    const showItemDropdown = () => {
        return category === ExpenseCategories.VEHICLE || category === ExpenseCategories.OFFICE;
    };

    const isRemarksRequired = () => {
        return category === ExpenseCategories.OTHERS || expenseItem === 'Others';
    };

    const handleSave = async () => {
        // Validation
        if (!category) {
            Alert.alert('Error', 'Please select a category');
            return;
        }

        if (!expenseItem.trim()) {
            Alert.alert('Error', 'Please enter expense item');
            return;
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        if (isRemarksRequired() && !remarks.trim()) {
            Alert.alert('Error', 'Remarks are required for this selection');
            return;
        }

        if (!userId) {
            Alert.alert('Error', 'User authentication error. Please try logging in again.');
            return;
        }

        setLoading(true);
        try {
            const expenseData: Expense = {
                id: expense?.id || uuidv4(),
                date: date.toISOString().split('T')[0],
                category,
                expense_item: expenseItem.trim(),
                amount: amountNum,
                remarks: remarks.trim() || undefined,
                created_by: userId,
                created_at: expense?.created_at || new Date().toISOString(),
                updated_by: isEditMode ? userId : undefined,
                updated_at: isEditMode ? new Date().toISOString() : undefined,
                edit_count: expense?.edit_count || 0,
            };

            if (isEditMode) {
                await ExpenseRepo.update(expenseData);
            } else {
                await ExpenseRepo.create(expenseData);
                // Show immediate notification for new expense
                NotificationHelper.notifyImmediate(
                    'Expense Added',
                    `Expenses - ${expenseData.expense_item} Rs ${expenseData.amount.toLocaleString()}`
                );
            }

            // Sync to Supabase
            await ExpenseRepo.syncPendingToRemote(userId);

            onSuccess?.();
            onClose();
            // Show success after modal closes
            setTimeout(() => {
                Alert.alert('Success', isEditMode ? 'Expense updated successfully' : 'Expense added successfully');
            }, 300);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save expense');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                style={styles.container}
                keyboardVerticalOffset={0}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>
                        {isEditMode ? 'Edit Expense' : 'Add Expense'}
                    </Text>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <X size={24} color={Colors.text} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={styles.formScroll}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.section}>
                        {/* Date */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Date *</Text>
                            <TouchableOpacity
                                style={styles.input}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Calendar size={18} color={Colors.textSecondary} />
                                <Text style={styles.dateText}>
                                    {date.toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </Text>
                            </TouchableOpacity>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={date}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) setDate(selectedDate);
                                    }}
                                />
                            )}
                        </View>

                        {/* Category */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Category *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={category}
                                    onValueChange={(value) => {
                                        setCategory(value);
                                        setExpenseItem(''); // Reset item when category changes
                                    }}
                                    style={styles.picker}
                                >
                                    {Object.values(ExpenseCategories).map((cat) => (
                                        <Picker.Item key={cat} label={cat} value={cat} />
                                    ))}
                                </Picker>
                            </View>
                        </View>

                        {/* Expense Item */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Expense Item *</Text>
                            {showItemDropdown() ? (
                                <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue={expenseItem}
                                        onValueChange={setExpenseItem}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Select item" value="" />
                                        {getItemOptions().map((item) => (
                                            <Picker.Item key={item} label={item} value={item} />
                                        ))}
                                    </Picker>
                                </View>
                            ) : (
                                <TextInput
                                    style={styles.input}
                                    value={expenseItem}
                                    onChangeText={setExpenseItem}
                                    placeholder="Enter expense item"
                                    placeholderTextColor={Colors.textSecondary}
                                />
                            )}
                        </View>

                        {/* Amount */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Amount *</Text>
                            <TextInput
                                style={styles.input}
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="0.00"
                                placeholderTextColor={Colors.textSecondary}
                                keyboardType="decimal-pad"
                            />
                        </View>

                        {/* Remarks */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                                Remarks {isRemarksRequired() && '*'}
                            </Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={remarks}
                                onChangeText={setRemarks}
                                placeholder="Any additional notes..."
                                placeholderTextColor={Colors.textSecondary}
                                multiline={true}
                                numberOfLines={3}
                                textAlignVertical="top"
                            />
                        </View>
                    </View>
                </ScrollView>

                {/* Footer */}
                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
                    <TouchableOpacity
                        style={[styles.footerButton, styles.cancelButton]}
                        onPress={handleClose}
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
                                <Save size={20} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={styles.saveButtonText}>
                                    {isEditMode ? 'Update' : 'Save'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
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
        paddingBottom: 120, // Extra padding for keyboard
    },
    section: {
        marginBottom: Spacing.lg,
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
        paddingVertical: 12,
        height: 48,
        fontSize: 15,
        color: Colors.text,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dateText: {
        fontSize: 15,
        color: Colors.text,
    },
    textArea: {
        height: 100,
        paddingTop: 12,
    },
    pickerContainer: {
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: Radius.md,
        overflow: 'hidden',
        justifyContent: 'center',
    },
    picker: {
        height: 50,
        color: Colors.text,
        fontSize: 15,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        padding: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        gap: Spacing.md,
        backgroundColor: '#F8F9FA',
        // Shadow for footer
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
        flexDirection: 'row',
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
        backgroundColor: Colors.danger,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFF',
    },
});
