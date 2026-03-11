import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Plus, Bell, Edit2, Trash2, CircleDot, CheckCircle2, Calendar, Clock, ChevronLeft } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { ReminderRepo, type Reminder } from '../db/reminderRepo';
import AddReminderModal from './AddReminderModal';
import { supabase } from '../lib/supabase';
import { Swipeable } from 'react-native-gesture-handler';
import { NotificationHelper } from '../utils/notificationHelper';
import { Switch } from 'react-native';

export default function ReminderScreen() {
    const navigation = useNavigation();
    const [activeTab, setActiveTab] = useState<'active' | 'all'>('active');
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingReminder, setEditingReminder] = useState<Reminder | undefined>();
    const [userId, setUserId] = useState<string>('');
    const [userRole, setUserRole] = useState<string>('');

    // Get user session
    useEffect(() => {
        async function getUserSession() {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id);

                // Get user role
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                if (profile) {
                    setUserRole(profile.role);
                }
            }
        }
        getUserSession();
        NotificationHelper.requestPermissions();
    }, []);

    const loadData = async () => {
        if (!userId) return;

        setLoading(true);
        try {
            await ReminderRepo.syncWithRemote(userId, userRole);
            const statusFilter = activeTab === 'active' ? 'Open' : undefined;
            const data = await ReminderRepo.getAll(userId, userRole, statusFilter);
            setReminders(data);
        } catch (error) {
            console.error('Failed to load reminders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [userId, userRole, activeTab])
    );

    const handleStatusToggle = async (reminder: Reminder) => {
        if (reminder.status === 'Close') return;

        Alert.alert(
            'Close Reminder',
            'Is this reminder close?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes',
                    onPress: async () => {
                        try {
                            await ReminderRepo.updateStatus(reminder.id, 'Close');
                            // Sync to remote immediately
                            if (userId) {
                                await ReminderRepo.syncPendingToRemote(userId);
                            }
                            // Cancel notification if it was scheduled
                            await NotificationHelper.cancelReminder(reminder.id);
                            await loadData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to update reminder status');
                        }
                    }
                }
            ]
        );
    };

    const handleEdit = (reminder: Reminder) => {
        setEditingReminder(reminder);
        setModalVisible(true);
    };

    const handleDelete = async (id: string) => {
        Alert.alert(
            'Delete Reminder',
            'Are you sure you want to delete this reminder?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await NotificationHelper.cancelReminder(id);
                            await ReminderRepo.delete(id);
                            await loadData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete reminder');
                        }
                    },
                },
            ]
        );
    };

    const renderRightActions = (reminder: Reminder) => {
        return (
            <View style={styles.swipeActions}>
                <TouchableOpacity
                    style={[styles.swipeButton, styles.editButton]}
                    onPress={() => handleEdit(reminder)}
                >
                    <Edit2 size={20} color="#FFF" />
                    <Text style={styles.swipeButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.swipeButton, styles.deleteButton]}
                    onPress={() => handleDelete(reminder.id)}
                >
                    <Trash2 size={20} color="#FFF" />
                    <Text style={styles.swipeButtonText}>Delete</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderReminderItem = ({ item }: { item: Reminder }) => (
        <Swipeable renderRightActions={() => renderRightActions(item)}>
            <View style={styles.listItem}>
                <View style={styles.listItemContent}>
                    <View style={[
                        styles.typeBadge,
                        { backgroundColor: item.type === 'Important' ? '#FF6B6B' : '#4ECDC4' }
                    ]}>
                        <Text style={styles.typeBadgeText}>{item.type}</Text>
                    </View>

                    <View style={styles.reminderBody}>
                        <Text style={styles.reminderText}>{item.reminder}</Text>

                        <View style={styles.reminderMeta}>
                            <View style={styles.metaItem}>
                                <Calendar size={14} color={Colors.textSecondary} />
                                <Text style={styles.metaText}>
                                    {new Date(item.date).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </Text>
                            </View>

                            {item.reminder_datetime && (
                                <View style={styles.metaItem}>
                                    <Clock size={14} color={Colors.textSecondary} />
                                    <Text style={styles.metaText}>
                                        {new Date(item.reminder_datetime).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {item.status === 'Open' && (
                        <View style={styles.statusToggleContainer}>
                            <Text style={styles.toggleLabel}>Slide to Close</Text>
                            <Switch
                                value={false}
                                onValueChange={() => handleStatusToggle(item)}
                                trackColor={{ false: '#CBD5E0', true: Colors.success }}
                                thumbColor="#FFF"
                            />
                        </View>
                    )}
                    {item.status === 'Close' && (
                        <CheckCircle2 size={24} color={Colors.success} style={styles.statusIcon} />
                    )}
                </View>
            </View>
        </Swipeable>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Reminders</Text>
                <View style={styles.headerRight} />
            </View>

            <View style={styles.container}>
                {/* Tab Navigation */}
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'active' && styles.tabActive]}
                        onPress={() => setActiveTab('active')}
                    >
                        <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
                            Active
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'all' && styles.tabActive]}
                        onPress={() => setActiveTab('all')}
                    >
                        <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                            All
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {loading && !refreshing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={reminders}
                        renderItem={renderReminderItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Bell size={64} color={Colors.textSecondary} />
                                <Text style={styles.emptyText}>No reminders yet</Text>
                            </View>
                        }
                    />
                )}

                {/* Floating Action Button */}
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => {
                        setEditingReminder(undefined);
                        setModalVisible(true);
                    }}
                >
                    <Plus size={24} color="#FFF" />
                </TouchableOpacity>

                {/* Add/Edit Modal */}
                <AddReminderModal
                    visible={modalVisible}
                    onClose={() => {
                        setModalVisible(false);
                        setEditingReminder(undefined);
                    }}
                    reminder={editingReminder}
                    userId={userId}
                    onSuccess={loadData}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.card,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 4,
    },
    backButton: {
        padding: 4,
        width: 40,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
        flex: 1,
        textAlign: 'center',
    },
    headerRight: {
        width: 40,
    },
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    tab: {
        flex: 1,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: Colors.primary,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    tabTextActive: {
        color: Colors.primary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 80,
    },
    listItem: {
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    listItemContent: {
        flexDirection: 'row',
        padding: Spacing.md,
        gap: Spacing.sm,
        alignItems: 'center',
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Radius.md,
    },
    typeBadgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '600',
    },
    reminderBody: {
        flex: 1,
    },
    reminderText: {
        fontSize: 15,
        color: Colors.text,
        marginBottom: 6,
    },
    reminderMeta: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    statusIcon: {
        marginLeft: Spacing.sm,
    },
    statusToggleContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    toggleLabel: {
        fontSize: 10,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyText: {
        marginTop: Spacing.md,
        fontSize: 16,
        color: Colors.textSecondary,
    },
    swipeActions: {
        flexDirection: 'row',
    },
    swipeButton: {
        width: 80,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },
    editButton: {
        backgroundColor: Colors.primary,
    },
    deleteButton: {
        backgroundColor: Colors.danger,
    },
    swipeButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    fab: {
        position: 'absolute',
        bottom: 90,
        right: Spacing.lg,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
});
