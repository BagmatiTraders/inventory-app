import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { Mail, Lock, ArrowRight, UserPlus, ShoppingCart } from 'lucide-react-native';
import { useSyncStore } from '../store/useSyncStore';

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { isOnline, checkConnection } = useSyncStore();

    async function signInWithEmail() {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        setLoading(true);
        try {
            const { data: { user }, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password,
            });

            if (error) {
                Alert.alert('Login Failed', error.message);
                return;
            }

            if (user) {
                // Check user status from profile
                const { data: profile, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('status')
                    .eq('id', user.id)
                    .single();

                if (profileError || !profile) {
                    await supabase.auth.signOut();
                    Alert.alert('Access Denied', 'Your account is waiting for admin approval. Please check back later.');
                    return;
                }

                if (profile.status === 'pending') {
                    await supabase.auth.signOut();
                    Alert.alert('Access Pending', 'Your account is waiting for admin approval. Please check back later.');
                    return;
                }

                if (profile.status === 'disable') {
                    await supabase.auth.signOut();
                    Alert.alert('Account Disabled', 'Your account has been disabled. Please contact the administrator.');
                    return;
                }

                if (profile.status !== 'active') {
                    await supabase.auth.signOut();
                    Alert.alert('Access Denied', 'Your account status is not active. Please contact the administrator.');
                    return;
                }
            }
        } catch (err: any) {
            console.error('Login error:', err);
            Alert.alert('Network Error', 'Could not connect to the server. Please check your internet or try again later.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.header}>
                        <View style={styles.logoPlaceholder}>
                            <ShoppingCart size={40} color="#FFFFFF" strokeWidth={2.5} />
                        </View>
                        <Text style={styles.title}>Welcome Back</Text>
                        <Text style={styles.subtitle}>Sign in to manage your inventory and purchases</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Email Address</Text>
                            <View style={styles.inputWrapper}>
                                <Mail size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="your@email.com"
                                    placeholderTextColor="#A0AEC0"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.inputWrapper}>
                                <Lock size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor="#A0AEC0"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.loginButton, loading && styles.disabledButton]}
                            onPress={signInWithEmail}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <Text style={styles.loginButtonText}>Sign In</Text>
                                    <ArrowRight size={20} color="#FFFFFF" />
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={styles.divider}>
                            <View style={styles.line} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.line} />
                        </View>

                        <TouchableOpacity
                            style={styles.signupButton}
                            onPress={() => navigation.navigate('Signup')}
                        >
                            <UserPlus size={20} color={Colors.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.signupButtonText}>Create New Account</Text>
                        </TouchableOpacity>
                    </View>
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
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: Spacing.xl,
        paddingTop: 60,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: Colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: Radius.md,
        paddingHorizontal: 12,
        height: 56,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: Colors.text,
    },
    loginButton: {
        flexDirection: 'row',
        backgroundColor: Colors.primary,
        height: 56,
        borderRadius: Radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        opacity: 0.7,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: 'bold',
        marginRight: 8,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 30,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: '#E2E8F0',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#A0AEC0',
        fontSize: 14,
        fontWeight: '600',
    },
    signupButton: {
        flexDirection: 'row',
        height: 56,
        borderRadius: Radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    signupButtonText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: '600',
    },
});
