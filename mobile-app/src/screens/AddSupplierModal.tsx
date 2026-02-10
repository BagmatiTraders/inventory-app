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
import { X, Users, Save } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { useDataStore } from '../store/useDataStore';

interface AddSupplierModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function AddSupplierModal({ visible, onClose }: AddSupplierModalProps) {
    const { addSupplier } = useDataStore();
    const [loading, setLoading] = useState(false);

    // Form State
    const [supplierName, setSupplierName] = useState('');
    const [contactDetails, setContactDetails] = useState('');
    const [remarks, setRemarks] = useState('');

    const resetForm = () => {
        setSupplierName('');
        setContactDetails('');
        setRemarks('');
    };

    useEffect(() => {
        if (visible) {
            resetForm();
        }
    }, [visible]);

    const handleSave = async () => {
        if (!supplierName.trim()) {
            Alert.alert('Error', 'Supplier name is required');
            return;
        }

        setLoading(true);
        try {
            await addSupplier({
                supplier_name: supplierName.trim(),
                contact_details: contactDetails.trim(),
                remarks: remarks.trim(),
            });

            Alert.alert('Success', 'Add Successful');
            onClose();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to add supplier');
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
                            <Users size={24} color={Colors.primary} />
                            <Text style={styles.headerTitle}>Add New Supplier</Text>
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
                        <View style={styles.section}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Supplier Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={supplierName}
                                    onChangeText={setSupplierName}
                                    placeholder="Enter supplier name"
                                    placeholderTextColor={Colors.textSecondary}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Contact Details</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={contactDetails}
                                    onChangeText={setContactDetails}
                                    placeholder="Phone, Email, Address..."
                                    placeholderTextColor={Colors.textSecondary}
                                    multiline={true}
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Remarks</Text>
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
                                    <Save size={20} color="#FFF" style={{ marginRight: 8 }} />
                                    <Text style={styles.saveButtonText}>Save Supplier</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
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
        height: '60%', // Suppliers form is shorter
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
    textArea: {
        height: 100,
        paddingTop: 12,
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
        backgroundColor: Colors.primary,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFF',
    },
});
