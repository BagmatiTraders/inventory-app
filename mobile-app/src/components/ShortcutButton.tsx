import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';

interface ShortcutButtonProps {
    label: string;
    icon: React.ReactNode;
    onPress: () => void;
    color?: string;
}

export const ShortcutButton: React.FC<ShortcutButtonProps> = ({ label, icon, onPress, color }) => {
    return (
        <TouchableOpacity style={styles.container} onPress={onPress}>
            <View style={[styles.iconContainer, { backgroundColor: color || Colors.primarySoft }]}>
                {icon}
            </View>
            <Text style={styles.label} numberOfLines={1}>{label}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '23%', // approx 4 items per row
        marginBottom: Spacing.md,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: Radius.round,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xs,
    },
    label: {
        fontSize: 12,
        color: Colors.text,
        textAlign: 'center',
    },
});
