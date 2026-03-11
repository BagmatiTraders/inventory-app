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
import { X, Bell, Save, Calendar, Clock } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { ReminderRepo, type Reminder } from '../db/reminderRepo';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values';
import { NotificationHelper } from '../utils/notificationHelper';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AddReminderModalProps {
    visible: boolean;
    onClose: () => void;
    reminder?: Reminder;
    userId: string;
    onSuccess?: () => void;
}

export default function AddReminderModal({ visible, onClose, reminder, userId, onSuccess }: AddReminderModalProps) {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);
    const isEditMode = !!reminder;

    // Form State
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [type, setType] = useState<'General' | 'Important'>('General');
    const [reminderText, setReminderText] = useState('');
    const [reminderDateTime, setReminderDateTime] = useState(new Date());
    const [showDateTimePicker, setShowDateTimePicker] = useState(false);
    const [dateTimePickerMode, setDateTimePickerMode] = useState<'date' | 'time'>('date');
    const [status, setStatus] = useState<'Open' | 'Close'>('Open');

    const resetForm = () => {
        setDate(new Date());
        setType('General');
        setReminderText('');
        setReminderDateTime(new Date());
        setStatus('Open');
    };

    useEffect(() => {
        if (visible) {
            if (reminder) {
                setDate(new Date(reminder.date));
                setType(reminder.type);
                setReminderText(reminder.reminder);
                setReminderDateTime(reminder.reminder_datetime ? new Date(reminder.reminder_datetime) : new Date());
                setStatus(reminder.status);
            } else {
                resetForm();
            }
        }
    }, [visible, reminder]);

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
        return reminderText.trim() !== '';
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

    const handleSave = async () => {
        // Validation
        if (!reminderText.trim()) {
            Alert.alert('Error', 'Please enter reminder text');
            return;
        }

        if (!userId) {
            Alert.alert('Error', 'User authentication error. Please try logging in again.');
            return;
        }

        setLoading(true);
        try {
            const reminderData: Reminder = {
                id: reminder?.id || uuidv4(),
                date: date.toISOString().split('T')[0],
                type,
                reminder: reminderText.trim(),
                reminder_datetime: type === 'Important' ? reminderDateTime.toISOString() : null,
                status,
                created_by: userId,
                created_at: reminder?.created_at || new Date().toISOString(),
            };

            if (isEditMode) {
                await ReminderRepo.update(reminderData);
            } else {
                await ReminderRepo.create(reminderData);
            }

            // Sync to Supabase
            await ReminderRepo.syncPendingToRemote(userId);

            // Handle Scheduling / Cancellation
            if (reminderData.status === 'Close') {
                await NotificationHelper.cancelReminder(reminderData.id);
            } else if (reminderData.type === 'Important' && reminderData.reminder_datetime) {
                await NotificationHelper.scheduleReminder(
                    reminderData.id,
                    `Reminder Alert - ${reminderData.reminder.substring(0, 30)}${reminderData.reminder.length > 30 ? '...' : ''}`,
                    reminderData.reminder,
                    new Date(reminderData.reminder_datetime)
                );
            } else {
                // If downgraded from Important to General, or datetime removed
                await NotificationHelper.cancelReminder(reminderData.id);
            }

            onSuccess?.();
            onClose();
            // Show success after modal closes
            setTimeout(() => {
                Alert.alert('Success', isEditMode ? 'Reminder updated successfully' : 'Reminder added successfully');
            }, 300);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save reminder');
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
                        {isEditMode ? 'Edit Reminder' : 'Add Reminder'}
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

                        {/* Type */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Type *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={type}
                                    onValueChange={setType}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="General" value="General" />
                                    <Picker.Item label="Important" value="Important" />
                                </Picker>
                            </View>
                        </View>

                        {/* Reminder DateTime (only for Important) */}
                        {type === 'Important' && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Reminder Date & Time *</Text>
                                <TouchableOpacity
                                    style={styles.input}
                                    onPress={() => {
                                        setDateTimePickerMode('date');
                                        setShowDateTimePicker(true);
                                    }}
                                >
                                    <Clock size={18} color={Colors.textSecondary} />
                                    <Text style={styles.dateText}>
                                        {reminderDateTime.toLocaleString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </Text>
                                </TouchableOpacity>
                                {showDateTimePicker && (
                                    <DateTimePicker
                                        value={reminderDateTime}
                                        mode={dateTimePickerMode}
                                        display="default"
                                        onChange={(event, selectedDate) => {
                                            if (Platform.OS === 'android') {
                                                setShowDateTimePicker(false);
                                                if (selectedDate) {
                                                    setReminderDateTime(selectedDate);
                                                    // After selecting date, show time picker
                                                    if (dateTimePickerMode === 'date') {
                                                        setTimeout(() => {
                                                            setDateTimePickerMode('time');
                                                            setShowDateTimePicker(true);
                                                        }, 100);
                                                    }
                                                }
                                            } else {
                                                // iOS handles both in one picker
                                                if (selectedDate) setReminderDateTime(selectedDate);
                                            }
                                        }}
                                    />
                                )}
                            </View>
                        )}

                        {/* Reminder Text */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Reminder *</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={reminderText}
                                onChangeText={setReminderText}
                                placeholder="Enter reminder..."
                                placeholderTextColor={Colors.textSecondary}
                                multiline={true}
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>

                        {/* Status */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Status *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={status}
                                    onValueChange={setStatus}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="Open" value="Open" />
                                    <Picker.Item label="Close" value="Close" />
                                </Picker>
                            </View>
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
        height: 120,
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
        backgroundColor: Colors.primary,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFF',
    },
});
