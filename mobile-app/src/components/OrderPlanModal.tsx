import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { X, Package, Box, ArrowRight, AlertTriangle, Info } from 'lucide-react-native';
import { DarazRepo } from '../db/darazRepo';
import { ProductRepo } from '../db/repo';
import { PurchaseRepo } from '../db/purchaseRepo';
import AddPurchasePlanModal from './AddPurchasePlanModal';

interface OrderPlanModalProps {
    visible: boolean;
    onClose: () => void;
    itemName: string;
    productId?: string;
    orderQty: number;
    productImage?: string;
}

interface ComponentItem {
    id: string;
    name: string;
    stock: number;
    image?: string;
    quantity: number; // Ratio
}

export default function OrderPlanModal({ visible, onClose, itemName, productId, orderQty, productImage }: OrderPlanModalProps) {
    const [loading, setLoading] = useState(true);
    const [globalDemand, setGlobalDemand] = useState(0);
    const [components, setComponents] = useState<ComponentItem[]>([]);
    const [isCombo, setIsCombo] = useState(false);

    // Add Plan Modal State
    const [showAddPlan, setShowAddPlan] = useState(false);
    const [selectedComponent, setSelectedComponent] = useState<ComponentItem | null>(null);

    useEffect(() => {
        if (visible) {
            loadData();
        }
    }, [visible, itemName, productId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Get Global Demand
            const demand = await DarazRepo.getProductGlobalDemand(productId || '', itemName);
            setGlobalDemand(demand);

            // 2. Get Components (if valid UUID)
            let comps: ComponentItem[] = [];
            if (productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {

                // Determine if it's a combo by checking if it has components
                const result = await ProductRepo.getProductComponents(productId);
                if (result.length > 0) {
                    setIsCombo(true);
                    comps = result.map((c: any) => ({
                        id: c.id,
                        name: c.name,
                        stock: c.stock,
                        image: c.image,
                        quantity: c.quantity
                    }));
                } else {
                    // It's a single product
                    setIsCombo(false);
                    // Fetch product details to get current stock/image
                    const p = await ProductRepo.getById(productId);
                    if (p) {
                        comps = [{
                            id: p.id,
                            name: p.name,
                            stock: p.stock,
                            image: p.image_url,
                            quantity: 1
                        }];
                    } else {
                        // Fallback if product not in local DB 
                        comps = [{
                            id: productId,
                            name: itemName,
                            stock: 0,
                            image: productImage,
                            quantity: 1
                        }];
                    }
                }
            } else {
                // No UUID
                setIsCombo(false);
                comps = [{
                    id: '',
                    name: itemName,
                    stock: 0,
                    image: productImage,
                    quantity: 1
                }];
            }
            setComponents(comps);
        } catch (error) {
            console.error('Error loading plan data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddComponent = async (comp: ComponentItem) => {
        if (!comp.id) {
            Alert.alert('Error', 'Cannot add unlinked product.');
            return;
        }

        const hasPending = await PurchaseRepo.hasPendingPlan(comp.id);
        if (hasPending) {
            Alert.alert('Already Added', `"${comp.name}" is already in your Daily Purchase List (Pending).`);
            return;
        }

        setSelectedComponent(comp);
        setShowAddPlan(true);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerTitle}>Select Product to Plan</Text>
                            <Text style={styles.headerSubtitle} numberOfLines={1}>
                                Choose component to add to daily plan
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.centerContainer}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                        </View>
                    ) : (
                        <View style={styles.body}>
                            {/* Order Info Section - Top */}
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>ORDER DETAILS</Text>
                            </View>

                            <View style={styles.orderContainer}>
                                <View style={styles.orderRow}>
                                    {productImage ? (
                                        <Image source={{ uri: productImage }} style={styles.orderImage} resizeMode="cover" />
                                    ) : (
                                        <View style={styles.orderPlaceholder}>
                                            <Package size={20} color={Colors.textSecondary} />
                                        </View>
                                    )}
                                    <View style={styles.orderInfo}>
                                        <Text style={styles.productName} numberOfLines={1}>{itemName}</Text>
                                        <View style={styles.tagsContainer}>
                                            <View style={styles.tag}>
                                                <Text style={styles.tagLabel}>Qty:</Text>
                                                <Text style={styles.tagValue}>{orderQty}</Text>
                                            </View>
                                            <View style={[styles.tag, { backgroundColor: '#E3F2FD', borderColor: '#BBDEFB' }]}>
                                                <Text style={[styles.tagLabel, { color: '#1565C0' }]}>Global Demand:</Text>
                                                <Text style={[styles.tagValue, { color: '#1565C0' }]}>{globalDemand}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Inventory Components Section - Bottom (Scrollable) */}
                            <View style={[styles.sectionHeader, { marginTop: Spacing.md }]}>
                                <Text style={styles.sectionTitle}>INVENTORY COMPONENTS</Text>
                            </View>

                            <ScrollView style={styles.componentList} showsVerticalScrollIndicator={false}>
                                {components.map((comp, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.componentCard}
                                        onPress={() => handleAddComponent(comp)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.cardInternal}>
                                            {/* Image */}
                                            {comp.image ? (
                                                <Image source={{ uri: comp.image }} style={styles.compImage} resizeMode="cover" />
                                            ) : (
                                                <View style={styles.compIcon}>
                                                    <Box size={20} color={Colors.textSecondary} />
                                                </View>
                                            )}

                                            {/* Info */}
                                            <View style={styles.compInfo}>
                                                <Text style={styles.compName} numberOfLines={2}>{comp.name}</Text>

                                                <View style={styles.compStats}>
                                                    {isCombo && comp.quantity > 1 && (
                                                        <View style={styles.bundleBadge}>
                                                            <Text style={styles.bundleText}>{comp.quantity}x Bundle</Text>
                                                        </View>
                                                    )}

                                                    <View style={[
                                                        styles.stockBadge,
                                                        { backgroundColor: comp.stock > 0 ? '#E8F5E9' : '#FFEBEE' }
                                                    ]}>
                                                        <Text style={[
                                                            styles.stockText,
                                                            { color: comp.stock > 0 ? '#2E7D32' : '#C62828' }
                                                        ]}>
                                                            Stock: {comp.stock}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Action */}
                                            <View style={styles.arrowContainer}>
                                                <ArrowRight size={20} color={Colors.primary} />
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}

                                {components.length === 0 && (
                                    <View style={styles.emptyState}>
                                        <AlertTriangle size={24} color={Colors.textSecondary} />
                                        <Text style={styles.emptyText}>No linked inventory found.</Text>
                                    </View>
                                )}

                                <View style={{ height: Spacing.xl }} />
                            </ScrollView>
                        </View>
                    )}
                </View>
            </View>

            {/* Add Plan Modal */}
            {selectedComponent && (
                <AddPurchasePlanModal
                    visible={showAddPlan}
                    onClose={() => setShowAddPlan(false)}
                    onSave={async (data) => {
                        try {
                            await PurchaseRepo.upsertPlan(data);
                            setShowAddPlan(false);
                            onClose();
                            Alert.alert('Success', 'Added to Purchase Plan');
                        } catch (error) {
                            console.error('Save error:', error);
                            Alert.alert('Error', 'Failed to save plan');
                        }
                    }}
                    initialProduct={{
                        id: selectedComponent.id,
                        name: selectedComponent.name,
                        stock: selectedComponent.stock,
                        sku: '',
                        price: 0,
                        updated_at: new Date().toISOString()
                    }}
                    initialQuantity={1}
                />
            )}
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end', // Bottom sheet style usually fits better, but let's stick to center
    },
    modalContent: {
        backgroundColor: '#F8F9FA',
        borderRadius: Radius.md,
        height: '75%',
        overflow: 'hidden',
        // Enhanced Shadow to match AddPurchasePlanModal
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: Spacing.md,
        backgroundColor: '#FFF',
        // Enhanced Header Shadow (No Border)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 15,
        zIndex: 20,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    closeButton: {
        padding: 4,
    },
    columnHeaders: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    columnTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#9E9E9E',
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    body: {
        flex: 1,
        padding: Spacing.md,
    },
    sectionHeader: {
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#9E9E9E',
        letterSpacing: 0.5,
    },
    orderContainer: {
        backgroundColor: '#FFF',
        borderRadius: Radius.md,
        padding: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 4,
    },
    orderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    orderImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: '#EEE',
    },
    orderPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: '#EEE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    orderInfo: {
        flex: 1,
        marginLeft: Spacing.sm,
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 6,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    tagLabel: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginRight: 4,
    },
    tagValue: {
        fontSize: 11,
        fontWeight: 'bold',
        color: Colors.text,
    },
    componentList: {
        flex: 1,
    },
    componentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: Colors.border,
        elevation: 1, // Subtle shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
    },
    cardInternal: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.sm,
    },
    compImage: {
        width: 48,
        height: 48,
        borderRadius: 6,
        backgroundColor: '#F9F9F9',
    },
    compIcon: {
        width: 48,
        height: 48,
        borderRadius: 6,
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    compInfo: {
        flex: 1,
        marginLeft: Spacing.sm,
        marginRight: Spacing.sm,
    },
    compName: {
        fontSize: 14,
        color: Colors.text,
        marginBottom: 6,
        fontWeight: '500',
    },
    compStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    bundleBadge: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    bundleText: {
        fontSize: 10,
        color: '#FFF',
        fontWeight: 'bold',
    },
    stockBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    stockText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    arrowContainer: {
        padding: 4,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
        marginTop: Spacing.lg,
    },
    emptyText: {
        marginTop: 8,
        color: Colors.textSecondary,
        fontSize: 13,
    }
});
