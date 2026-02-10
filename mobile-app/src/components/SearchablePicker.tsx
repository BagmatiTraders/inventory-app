import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    FlatList,
    SafeAreaView,
} from 'react-native';
import { Search, X, Check } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';

interface Item {
    id: string;
    name: string;
}

interface SearchablePickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (item: Item) => void;
    items: Item[];
    placeholder: string;
    title: string;
    selectedId?: string;
}

export default function SearchablePicker({
    visible,
    onClose,
    onSelect,
    items,
    placeholder,
    title,
    selectedId,
}: SearchablePickerProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredItems = items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderItem = ({ item }: { item: Item }) => (
        <TouchableOpacity
            style={[
                styles.item,
                item.id === selectedId && styles.selectedItem
            ]}
            onPress={() => {
                onSelect(item);
                onClose();
                setSearchQuery('');
            }}
        >
            <Text style={[
                styles.itemText,
                item.id === selectedId && styles.selectedItemText
            ]}>
                {item.name}
            </Text>
            {item.id === selectedId && <Check size={20} color={Colors.primary} />}
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>{title}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={24} color={Colors.text} />
                    </TouchableOpacity>
                </View>

                <View style={styles.searchContainer}>
                    <View style={styles.searchWrapper}>
                        <Search size={20} color={Colors.textSecondary} style={styles.searchIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={placeholder}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                    </View>
                </View>

                <FlatList
                    data={filteredItems}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No items found</Text>
                        </View>
                    }
                />
            </SafeAreaView>
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
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    closeButton: {
        padding: 4,
    },
    searchContainer: {
        padding: Spacing.md,
        backgroundColor: '#F8F9FA',
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: Radius.md,
        paddingHorizontal: 12,
        height: 48,
    },
    searchIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: Colors.text,
    },
    list: {
        paddingVertical: Spacing.sm,
    },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F3F5',
    },
    selectedItem: {
        backgroundColor: '#F0F7FF',
    },
    itemText: {
        fontSize: 16,
        color: Colors.text,
    },
    selectedItemText: {
        color: Colors.primary,
        fontWeight: '600',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.textSecondary,
        fontSize: 16,
    },
});
