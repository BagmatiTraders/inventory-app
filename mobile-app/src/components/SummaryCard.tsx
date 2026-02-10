import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';

interface SummaryCardProps {
    title: string;
    items: { label: string; value: string | number; color?: string }[];
    onPress?: () => void;
    backgroundColor?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ title, items, onPress, backgroundColor }) => {
    return (
        <View style={[styles.container, { backgroundColor: backgroundColor || Colors.card }]}>
            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
            </View>
            <View style={styles.row}>
                {items.map((item, index) => (
                    <View key={index} style={styles.item}>
                        <Text style={[styles.value, { color: item.color || Colors.text }]}>{item.value}</Text>
                        <Text style={styles.label}>{item.label}</Text>
                    </View>
                ))}
            </View>
            {onPress && (
                <TouchableOpacity style={styles.footer} onPress={onPress}>
                    <Text style={styles.footerText}>View More</Text>
                    <ChevronRight size={16} color={Colors.primary} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginVertical: Spacing.sm,
        width: '100%',
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        marginBottom: Spacing.sm,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    item: {
        flex: 1,
        alignItems: 'center',
    },
    value: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    label: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        paddingTop: Spacing.sm,
    },
    footerText: {
        fontSize: 12,
        color: Colors.primary,
        marginRight: 4,
    },
});
