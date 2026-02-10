import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useDataStore } from '../store/useDataStore';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import SearchablePicker from '../components/SearchablePicker';
import { PackageOpen, Save, ChevronRight, History, Package } from 'lucide-react-native';

export default function OpeningStockScreen() {
    const { products, openingStocks, addOpeningStock, isLoading } = useDataStore();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [location, setLocation] = useState('Main Store');
    const [productId, setProductId] = useState('');
    const [productName, setProductName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [remarks, setRemarks] = useState('');

    const [locationPickerVisible, setLocationPickerVisible] = useState(false);
    const [productPickerVisible, setProductPickerVisible] = useState(false);

    const locations = [
        { id: 'Main Store', name: 'Main Store' },
        { id: 'Store 1', name: 'Store 1' },
        { id: 'Store 2', name: 'Store 2' },
    ];

    const productItems = products.map(p => ({
        id: p.id,
        name: p.name
    }));

    const handleSave = async () => {
        if (!productId || !quantity || !location) {
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }

        try {
            await addOpeningStock({
                date,
                location,
                product_id: productId,
                quantity: parseFloat(quantity),
                remarks
            });
            Alert.alert('Success', 'Opening stock added successfully');
            setProductId('');
            setProductName('');
            setQuantity('');
            setRemarks('');
        } catch (error) {
            Alert.alert('Error', 'Failed to save opening stock');
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.historyCard}>
            <View style={styles.historyMain}>
                <View style={styles.historyInfo}>
                    <Text style={styles.historyProductName}>{item.product_name}</Text>
                    <Text style={styles.historyDate}>{item.date} • {item.location}</Text>
                </View>
                <View style={styles.historyQtyBadge}>
                    <Text style={styles.historyQtyText}>{item.quantity}</Text>
                </View>
            </View>
            {item.remarks ? (
                <Text style={styles.historyRemarks}>{item.remarks}</Text>
            ) : null}
            <View style={[styles.syncBadge, { backgroundColor: item.sync_status === 'synced' ? '#d1fae5' : '#fee2e2' }]}>
                <Text style={[styles.syncText, { color: item.sync_status === 'synced' ? '#10b981' : '#ef4444' }]}>
                    {item.sync_status === 'synced' ? 'Synced' : 'Pending'}
                </Text>
            </View>
        </View>
    );

    const Header = () => (
        <View style={styles.formContainer}>
            <View style={styles.form}>
                <Text style={styles.label}>Date</Text>
                <Text style={styles.inputStatic}>{date}</Text>

                <Text style={styles.label}>Location</Text>
                <TouchableOpacity
                    style={styles.pickerTrigger}
                    onPress={() => setLocationPickerVisible(true)}
                >
                    <Text style={location ? styles.pickerValue : styles.pickerPlaceholder}>
                        {location || 'Select Location'}
                    </Text>
                    <ChevronRight size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                <Text style={styles.label}>Product</Text>
                <TouchableOpacity
                    style={styles.pickerTrigger}
                    onPress={() => setProductPickerVisible(true)}
                >
                    <Text style={productName ? styles.pickerValue : styles.pickerPlaceholder}>
                        {productName || 'Select Product'}
                    </Text>
                    <ChevronRight size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                <Text style={styles.label}>Quantity</Text>
                <View style={styles.inputContainer}>
                    <PackageOpen size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        value={quantity}
                        onChangeText={setQuantity}
                    />
                </View>

                <Text style={styles.label}>Remarks</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Optional remarks"
                    multiline
                    numberOfLines={3}
                    value={remarks}
                    onChangeText={setRemarks}
                />

                <TouchableOpacity
                    style={[styles.saveButton, isLoading && styles.disabledButton]}
                    onPress={handleSave}
                    disabled={isLoading}
                >
                    <Save size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>{isLoading ? 'Saving...' : 'Save Opening Stock'}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.historyHeader}>
                <History size={18} color={Colors.text} />
                <Text style={styles.historyTitle}>Recent History</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={openingStocks}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={<Header />}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Package size={32} color={Colors.border} />
                        <Text style={styles.emptyText}>No history available</Text>
                    </View>
                }
            />

            <SearchablePicker
                visible={locationPickerVisible}
                onClose={() => setLocationPickerVisible(false)}
                onSelect={(item) => setLocation(item.name)}
                items={locations}
                placeholder="Search location..."
                title="Select Location"
                selectedId={location}
            />

            <SearchablePicker
                visible={productPickerVisible}
                onClose={() => setProductPickerVisible(false)}
                onSelect={(item) => {
                    setProductId(item.id);
                    setProductName(item.name);
                }}
                items={productItems}
                placeholder="Search product..."
                title="Select Product"
                selectedId={productId}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    list: {
        paddingBottom: Spacing.xl,
    },
    formContainer: {
        padding: Spacing.md,
    },
    form: {
        // marginBottom: Spacing.lg,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: Spacing.xs,
        marginTop: Spacing.md,
    },
    inputStatic: {
        backgroundColor: Colors.card,
        padding: Spacing.sm + 2,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        color: Colors.text,
        fontSize: 16,
    },
    pickerTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.card,
        padding: Spacing.sm + 2,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    pickerValue: {
        fontSize: 16,
        color: Colors.text,
    },
    pickerPlaceholder: {
        fontSize: 16,
        color: Colors.textSecondary,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    inputIcon: {
        marginLeft: Spacing.sm,
    },
    input: {
        flex: 1,
        padding: Spacing.sm,
        color: Colors.text,
        fontSize: 16,
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
        backgroundColor: Colors.card,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.sm,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
        borderRadius: Radius.lg,
        marginTop: Spacing.lg,
        gap: Spacing.sm,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    disabledButton: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    historyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.xl,
        marginBottom: Spacing.md,
        gap: Spacing.xs,
    },
    historyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    historyCard: {
        backgroundColor: Colors.card,
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
        padding: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    historyMain: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    historyInfo: {
        flex: 1,
    },
    historyProductName: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    historyDate: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    historyQtyBadge: {
        backgroundColor: Colors.primarySoft,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: Radius.md,
    },
    historyQtyText: {
        color: Colors.primary,
        fontWeight: 'bold',
        fontSize: 14,
    },
    historyRemarks: {
        marginTop: 8,
        fontSize: 13,
        color: Colors.textSecondary,
        fontStyle: 'italic',
    },
    syncBadge: {
        alignSelf: 'flex-start',
        marginTop: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: Radius.round,
    },
    syncText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        color: Colors.textSecondary,
        marginTop: 8,
    },
});
