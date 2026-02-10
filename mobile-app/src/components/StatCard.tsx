import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

interface StatCardProps {
    title: string;
    value: string | number;
    subValue?: string;
    icon?: LucideIcon;
    color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subValue, icon: Icon, color = '#3b82f6' }) => {
    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                {Icon && <Icon size={20} color={color} />}
            </View>
            <View style={styles.content}>
                <Text style={[styles.value, { color }]}>{value}</Text>
                {subValue && <Text style={styles.subValue}>{subValue}</Text>}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        flex: 1, // Allow flex grow in row layouts
        minWidth: '45%', // Ensure reasonable width in grid
        marginHorizontal: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    content: {
        alignItems: 'flex-start',
    },
    value: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 4,
    },
    subValue: {
        fontSize: 12,
        color: '#9ca3af',
    },
});
