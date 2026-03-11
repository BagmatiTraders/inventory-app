import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, User, Mail, Lock, Edit2, Save, LogOut } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';

export default function ProfileScreen() {
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [user, setUser] = useState<any>(null);

    // Profile State
    const [isEditing, setIsEditing] = useState(false);
    const [displayName, setDisplayName] = useState('');

    // Password State
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            setDisplayName(user?.user_metadata?.display_name || '');
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async () => {
        setUpdating(true);
        try {
            const { error } = await supabase.auth.updateUser({
                data: { display_name: displayName }
            });

            if (error) throw error;

            Alert.alert('Success', 'Profile updated successfully');
            setIsEditing(false);
            fetchProfile();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setUpdating(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            Alert.alert(
                'Success',
                'Password changed successfully. You will be logged out now. Please login with your new password.',
                [{ text: 'OK', onPress: () => handleSignOut() }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Account</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Profile Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Profile Details</Text>
                            {!isEditing && (
                                <TouchableOpacity onPress={() => setIsEditing(true)}>
                                    <Edit2 size={18} color={Colors.primary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.card}>
                            <View style={styles.infoRow}>
                                <Mail size={18} color={Colors.textSecondary} style={styles.icon} />
                                <View>
                                    <Text style={styles.infoLabel}>Email</Text>
                                    <Text style={styles.infoValue}>{user?.email}</Text>
                                </View>
                            </View>

                            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                                <User size={18} color={Colors.textSecondary} style={styles.icon} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.infoLabel}>Display Name</Text>
                                    {isEditing ? (
                                        <TextInput
                                            style={styles.input}
                                            value={displayName}
                                            onChangeText={setDisplayName}
                                            placeholder="Enter your name"
                                            autoFocus
                                        />
                                    ) : (
                                        <Text style={styles.infoValue}>{displayName || 'Not set'}</Text>
                                    )}
                                </View>
                            </View>
                        </View>

                        {isEditing && (
                            <View style={styles.editActions}>
                                <TouchableOpacity
                                    style={[styles.button, styles.cancelButton]}
                                    onPress={() => {
                                        setIsEditing(false);
                                        setDisplayName(user?.user_metadata?.display_name || '');
                                    }}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.button, styles.saveButton]}
                                    onPress={handleUpdateProfile}
                                    disabled={updating}
                                >
                                    {updating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Change Password Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Security</Text>
                        </View>

                        {!isChangingPassword ? (
                            <TouchableOpacity
                                style={styles.changePasswordTrigger}
                                onPress={() => setIsChangingPassword(true)}
                            >
                                <Lock size={18} color={Colors.text} style={styles.icon} />
                                <Text style={styles.changePasswordText}>Change Password</Text>
                                <ChevronLeft size={20} color={Colors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.card}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>New Password</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        placeholder="Min 6 characters"
                                        secureTextEntry
                                    />
                                </View>
                                <View style={[styles.inputGroup, { borderBottomWidth: 0 }]}>
                                    <Text style={styles.inputLabel}>Confirm New Password</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        placeholder="Repeat new password"
                                        secureTextEntry
                                    />
                                </View>

                                <View style={styles.passwordActions}>
                                    <TouchableOpacity
                                        style={[styles.button, styles.cancelButton]}
                                        onPress={() => {
                                            setIsChangingPassword(false);
                                            setNewPassword('');
                                            setConfirmPassword('');
                                        }}
                                    >
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.button, styles.saveButton]}
                                        onPress={handleChangePassword}
                                        disabled={updating}
                                    >
                                        {updating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Update Password</Text>}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Data Management Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Data Management</Text>
                        </View>
                        <View style={styles.card}>
                            <Text style={styles.infoLabel}>If you see data discrepancies or calculation errors, you can force a fresh sync from the server.</Text>
                            <TouchableOpacity
                                style={[styles.button, styles.resetButton, { marginTop: Spacing.md }]}
                                onPress={() => {
                                    Alert.alert(
                                        'Force Re-sync?',
                                        'This will clear all local data and download everything again from Supabase. This may take a minute.',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Proceed',
                                                style: 'destructive',
                                                onPress: async () => {
                                                    try {
                                                        const { useDataStore } = await import('../store/useDataStore');
                                                        await useDataStore.getState().resetAndSync();
                                                        Alert.alert('Success', 'Data has been reset and synchronized.');
                                                    } catch (error: any) {
                                                        Alert.alert('Error', 'Failed to reset data: ' + error.message);
                                                    }
                                                }
                                            }
                                        ]
                                    );
                                }}
                            >
                                <Save size={18} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={styles.saveButtonText}>Force Data Re-sync</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Sign Out Button (Logout automatically handles the session) */}
                    <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                        <LogOut size={20} color={Colors.danger} style={{ marginRight: 12 }} />
                        <Text style={styles.signOutButtonText}>Sign Out from All Devices</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        backgroundColor: Colors.card,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
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
    },
    section: {
        marginBottom: Spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.textSecondary,
        textTransform: 'uppercase',
    },
    card: {
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    icon: {
        marginRight: Spacing.md,
    },
    infoLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    infoValue: {
        fontSize: 15,
        color: Colors.text,
        fontWeight: '500',
    },
    input: {
        fontSize: 15,
        color: Colors.text,
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: Colors.primary,
    },
    editActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: Spacing.sm,
        gap: Spacing.sm,
    },
    button: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
        borderRadius: Radius.md,
        minWidth: 100,
        alignItems: 'center',
    },
    saveButton: {
        backgroundColor: Colors.primary,
    },
    saveButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    resetButton: {
        backgroundColor: Colors.warning,
        flexDirection: 'row',
        width: '100%',
    },
    cancelButton: {
        backgroundColor: 'transparent',
    },
    cancelButtonText: {
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    changePasswordTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    changePasswordText: {
        flex: 1,
        fontSize: 15,
        color: Colors.text,
        fontWeight: '500',
    },
    inputGroup: {
        marginBottom: Spacing.md,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 4,
    },
    passwordActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: Spacing.md,
        gap: Spacing.sm,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
        marginTop: Spacing.xl,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.danger,
    },
    signOutButtonText: {
        color: Colors.danger,
        fontWeight: 'bold',
        fontSize: 15,
    },
});
