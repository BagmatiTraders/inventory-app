import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';

interface HeaderProps {
    title?: string;
    showProfile?: boolean;
    showNotification?: boolean;
}

export const AppHeader = ({ title = 'Bagmati Traders', showProfile = true, showNotification = true }: HeaderProps) => {
    const insets = useSafeAreaInsets();
    const handlePress = (label: string) => {
        Alert.alert('Action', `You pressed ${label}`);
    };

    return (
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
            <View style={styles.leftSlot}>
                {showProfile && (
                    <TouchableOpacity style={styles.profileIcon} onPress={() => handlePress('Profile')}>
                        <Text style={styles.profileInitial}>B</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.centerSlot}>
                <Text style={styles.businessName}>{title}</Text>
            </View>

            <View style={styles.rightSlot}>
                {showNotification && (
                    <TouchableOpacity style={styles.iconButton} onPress={() => handlePress('Notifications')}>
                        <Bell size={24} color={Colors.text} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        backgroundColor: Colors.card,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 15,
        zIndex: 10,
    },
    leftSlot: {
        width: 50,
        alignItems: 'flex-start',
    },
    centerSlot: {
        flex: 1,
        alignItems: 'center',
    },
    rightSlot: {
        width: 50,
        alignItems: 'flex-end',
    },
    profileIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileInitial: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    businessName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
        textAlign: 'center',
    },
    iconButton: {
        padding: 4,
    },
});
