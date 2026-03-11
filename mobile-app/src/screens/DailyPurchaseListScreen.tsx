import React, { useEffect, useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, RefreshControl, Image, Alert, Modal, ScrollView, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { useDataStore } from '../store/useDataStore';
import { PurchaseRepo, PurchasePlan, Purchase } from '../db/purchaseRepo';
import { Check, X, ShoppingCart, Clock, Calendar, Package, Edit, Plus, ChevronDown, Search, Save } from 'lucide-react-native';
import AddPurchaseModal from './AddPurchaseModal';
import AddPurchasePlanModal from '../components/AddPurchasePlanModal';
import { ProductRepo, Product } from '../db/repo';

const CountdownTimer = ({ expiryDate }: { expiryDate: string }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculateTime = () => {
            const now = new Date().getTime();
            const distance = new Date(expiryDate).getTime() - now;

            if (distance < 0) {
                setTimeLeft('Expired');
                return;
            }

            const h = Math.floor(distance / (1000 * 60 * 60));
            const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((distance % (1000 * 60)) / 1000);

            setTimeLeft(`${h}h ${m}m ${s}s`);
        };

        const timer = setInterval(calculateTime, 1000);
        calculateTime();
        return () => clearInterval(timer);
    }, [expiryDate]);

    return <Text style={styles.countdownText}>{timeLeft}</Text>;
};

const PurchasePlanDetailsModal = ({
    visible,
    onClose,
    plan
}: {
    visible: boolean,
    onClose: () => void,
    plan: PurchasePlan | null
}) => {
    const [history, setHistory] = useState<Purchase[]>([]);

    useEffect(() => {
        if (visible && plan) {
            fetchHistory();
        }
    }, [visible, plan]);

    const fetchHistory = async () => {
        if (!plan) return;
        const data = await PurchaseRepo.getHistoryForProduct(plan.product_id, 3);
        setHistory(data);
    };

    if (!plan) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.detailsModalOverlay}>
                <View style={styles.detailsModalContent}>
                    {/* Sticky Header with shadow */}
                    <View style={styles.detailsHeaderSticky}>
                        <Text style={styles.detailsTitle} numberOfLines={1}>
                            Details: {plan.product?.product_name}
                        </Text>
                    </View>

                    <ScrollView
                        style={styles.modalScrollBody}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
                        <View style={styles.modalBodyPadding}>
                            {/* Planned Date & Status */}
                            <View style={styles.detailsGrid}>
                                <View style={styles.detailsItem}>
                                    <Text style={styles.detailsLabel}>Planned Date</Text>
                                    <View style={styles.detailsValueRow}>
                                        <Calendar size={16} color={Colors.textSecondary} />
                                        <Text style={styles.detailsValue}> {plan.plan_date}</Text>
                                    </View>
                                </View>
                                <View style={[styles.detailsItem, { alignItems: 'flex-end' }]}>
                                    <Text style={styles.detailsLabel}>Status</Text>
                                    <View style={[styles.statusBadge, { backgroundColor: plan.status === 'Pending' ? '#FFFBEB' : '#F0FFF4' }]}>
                                        <Text style={[styles.statusBadgeText, { color: plan.status === 'Pending' ? '#B45309' : '#2F855A' }]}>
                                            {plan.status}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Target Qty & SKUs */}
                            <View style={styles.detailsGrid}>
                                <View style={styles.detailsItem}>
                                    <Text style={styles.detailsLabel}>Target Qty</Text>
                                    <Text style={styles.detailsValue}>{plan.quantity}</Text>
                                </View>
                                <View style={[styles.detailsItem, { alignItems: 'flex-end', flex: 2 }]}>
                                    <Text style={styles.detailsLabel}>Seller SKUs</Text>
                                    <Text style={styles.detailsValue} numberOfLines={1}>{plan.product?.sku || 'N/A'}</Text>
                                </View>
                            </View>

                            {/* Remarks */}
                            <View style={styles.remarksSection}>
                                <Text style={styles.detailsLabel}>Remarks</Text>
                                <View style={styles.remarksBox}>
                                    <Text style={styles.remarksText}>{plan.remarks || 'No remarks'}</Text>
                                </View>
                            </View>

                            <View style={styles.detailsDivider} />

                            {/* Analysis Data Section */}
                            <Text style={styles.sectionTitleSmall}>Analysis Data</Text>
                            <View style={styles.analysisGrid}>
                                <View style={[styles.analysisCard, styles.latestCard]}>
                                    <Text style={styles.analysisLabelBlue}>LATEST PURCHASE</Text>
                                    <Text style={styles.analysisPrice}>Rs. {plan.snapshot_latest_price || 0}</Text>
                                    <Text style={styles.analysisSupplier} numberOfLines={2}>{plan.snapshot_latest_supplier || 'N/A'}</Text>
                                </View>
                                <View style={[styles.analysisCard, styles.lowCard]}>
                                    <Text style={styles.analysisLabelGreen}>ALL-TIME LOW</Text>
                                    <Text style={styles.analysisPrice}>Rs. {plan.snapshot_low_price || 0}</Text>
                                    <Text style={styles.analysisSupplier} numberOfLines={2}>{plan.snapshot_low_supplier || 'N/A'}</Text>
                                </View>
                            </View>

                            <View style={styles.detailsDivider} />

                            {/* Last 3 Purchases - Tabular format */}
                            <Text style={styles.sectionTitleSmall}>Last 3 Purchases</Text>
                            <View style={styles.historyTable}>
                                <View style={styles.tableHeaderRow}>
                                    <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Date</Text>
                                    <Text style={[styles.tableHeaderText, { flex: 0.6 }]}>Qty</Text>
                                    <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Price</Text>
                                    <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Supplier</Text>
                                </View>
                                {history.length > 0 ? history.map((h, i) => (
                                    <View key={h.id || i} style={styles.tableBodyRow}>
                                        <Text style={[styles.tableCellText, { flex: 1.2 }]}>{h.purchase_date}</Text>
                                        <Text style={[styles.tableCellText, { flex: 0.6 }]}>{h.quantity}</Text>
                                        <Text style={[styles.tableCellText, { flex: 0.8 }]}>Rs. {h.unit_amount}</Text>
                                        <Text style={[styles.tableCellText, { flex: 1.5 }]} numberOfLines={2}>{h.supplier?.supplier_name}</Text>
                                    </View>
                                )) : (
                                    <View style={styles.noHistoryContainer}>
                                        <Text style={styles.noHistoryText}>No purchase history found</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </ScrollView>

                    {/* Sticky Footer Actions */}
                    <View style={styles.detailsFooterSticky}>
                        <TouchableOpacity style={styles.modalCloseButtonOutlined} onPress={onClose}>
                            <Text style={styles.modalCloseButtonText}>Close</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalEditButtonFilled}>
                            <Edit size={16} color="#4A5568" />
                            <Text style={styles.modalEditButtonText}>Edit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};



const PurchasePlanCard = ({ item, onStatusUpdate, onImagePress, onDetailsPress, onAddPurchase, isAlreadyEntered }: {
    item: any,
    onStatusUpdate: (id: string, status: any) => void,
    onImagePress?: (url: string) => void,
    onDetailsPress?: (plan: any) => void,
    onAddPurchase?: (plan: any) => void,
    isAlreadyEntered?: boolean
}) => {

    const isPending = item.status === 'Pending';
    const isComplete = item.status === 'Complete';
    const isCancel = item.status === 'Cancel';

    const handleEntry = () => {
        onAddPurchase?.(item);
    };

    return (
        <View style={[styles.card, isAlreadyEntered && styles.purchasedCard]}>
            {/* Header: Countdown and High Price */}
            <View style={styles.cardTopRow}>
                <CountdownTimer expiryDate={item.expires_at} />
                <Text style={styles.topPriceText}>Rs. {item.snapshot_low_price || 0}</Text>
            </View>

            <View style={styles.dividerDashed} />

            {/* Middle: Image and Name */}
            <View style={styles.cardMainRow}>
                <TouchableOpacity
                    style={styles.imageContainer}
                    onPress={() => item.product?.image_url && onImagePress?.(item.product.image_url)}
                    disabled={!item.product?.image_url || isAlreadyEntered}
                >
                    {item.product?.image_url ? (
                        <Image source={{ uri: item.product.image_url }} style={styles.productImage} />
                    ) : (
                        <View style={styles.placeholderImage}>
                            <ShoppingCart size={24} color={Colors.textSecondary} />
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.productInfoArea}
                    onPress={() => onDetailsPress?.(item)}
                    disabled={isAlreadyEntered}
                >
                    <Text style={[styles.productNameText, isAlreadyEntered && styles.entryDoneTextPrimary]}>
                        {item.product?.product_name || 'Syncing...'}
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.dividerDashed} />

            {/* Info Row: Qty and L. Price */}
            <View style={styles.infoRow}>
                <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>Qty:</Text>
                    <Text style={styles.infoValue}>{item.quantity}</Text>
                </View>
                <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>L. Price: </Text>
                    <Text style={styles.infoValue}>Rs. {item.snapshot_latest_price || 0}</Text>
                </View>
            </View>

            <View style={styles.dividerSolid} />

            {/* Footer: Actions */}
            <View style={styles.cardActions}>
                {isAlreadyEntered ? (
                    <View style={[styles.addPurchaseBigButton, styles.entryDoneButton]}>
                        <Text style={[styles.addPurchaseBigButtonText, styles.entryDoneText]}>Entry Done</Text>
                    </View>
                ) : (
                    <>
                        {isPending && (
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.completeButton]}
                                    onPress={() => onStatusUpdate(item.id, 'Choice')}
                                >
                                    <Check size={18} color="#4A5568" />
                                    <Text style={styles.completeButtonText}>Complete</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.cancelButton]}
                                    onPress={() => {
                                        Alert.alert(
                                            'Cancel Plan',
                                            'Are you sure to cancel?',
                                            [
                                                { text: 'No', style: 'cancel' },
                                                { text: 'Yes', onPress: () => onStatusUpdate(item.id, 'Cancel'), style: 'destructive' }
                                            ]
                                        );
                                    }}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {isComplete && (
                            <TouchableOpacity
                                style={styles.addPurchaseBigButton}
                                onPress={handleEntry}
                            >
                                <Text style={styles.addPurchaseBigButtonText}>Add Purchase</Text>
                            </TouchableOpacity>
                        )}

                        {isCancel && (
                            <View style={styles.cancelledBadgeWide}>
                                <Text style={styles.cancelledTextWide}>Cancelled</Text>
                            </View>
                        )}
                    </>
                )}
            </View>
        </View>
    );
};

export default function DailyPurchaseListScreen() {
    const navigation = useNavigation();
    const { purchasePlans, todayPurchases, isLoading, refreshData, syncPurchasingData, updatePlanStatus } = useDataStore();
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<PurchasePlan | null>(null);
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [isPurchaseModalVisible, setIsPurchaseModalVisible] = useState(false);
    const [choiceModalVisible, setChoiceModalVisible] = useState(false);
    const [completingPlanId, setCompletingPlanId] = useState<string | null>(null);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => null
        });
    }, [navigation]);

    const handleStatusUpdate = async (id: string, status: any) => {
        if (status === 'Choice') {
            setCompletingPlanId(id);
            setChoiceModalVisible(true);
            return;
        }
        await updatePlanStatus(id, status);
    };

    const handleChoiceSelection = async (action: 'Done' | 'Entry') => {
        if (!completingPlanId) return;

        await updatePlanStatus(completingPlanId, 'Complete');
        setChoiceModalVisible(false);
        setCompletingPlanId(null);

        if (action === 'Entry') {
            const plan = purchasePlans.find(p => p.id === completingPlanId);
            if (plan) {
                setSelectedPlan(plan);
                setIsPurchaseModalVisible(true);
            }
        }
    };

    useEffect(() => {
        refreshData();
        syncPurchasingData();
        const unsubscribe = useDataStore.getState().subscribeToChanges();
        return unsubscribe;
    }, []);

    const onRefresh = async () => {
        await syncPurchasingData();
    };

    const handleSavePlan = async (data: any) => {
        try {
            const newPlan: PurchasePlan = {
                id: Math.random().toString(36).substring(7), // In prod use UUID
                ...data,
                created_at: new Date().toISOString(),
                expires_at: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString(), // Default 24h
                sync_status: 'pending'
            };

            // Fast local save
            await PurchaseRepo.upsertPlan(newPlan);

            // Refresh list immediately
            refreshData();

            setIsAddModalVisible(false);
        } catch (error) {
            console.error('Save plan failed:', error);
            Alert.alert('Error', 'Failed to save purchase plan');
        }
    };

    // Helper to check if a plan is already purchased
    const checkIsPurchased = (item: any) => {
        if (item.status === 'Pending') return false;
        return todayPurchases.some(p => {
            const pId = String(p.product_id || '').trim();
            const itemId = String(item.product_id || '').trim();
            const pName = (p.product?.product_name || p.purchase_name || '').trim().toLowerCase();
            const itemName = (item.product?.product_name || item.cached_product_name || '').trim().toLowerCase();

            const idMatch = pId && itemId && pId === itemId;
            const nameMatch = pName && itemName && pName === itemName;

            return idMatch || nameMatch;
        });
    };

    // Correct section grouping based on prompt requirements
    // Filter and group plans
    const now = new Date().toISOString();
    const activePlans = purchasePlans.filter(p => p.status === 'Pending' || p.expires_at > now);

    const sections = [
        {
            title: 'Pending Items',
            data: activePlans.filter(p => p.status === 'Pending' && !checkIsPurchased(p)),
        },
        {
            title: 'Manually Completed',
            data: activePlans.filter(p => p.status === 'Complete' && !checkIsPurchased(p)),
        },
        {
            title: 'Purchased Today',
            data: activePlans.filter(p => checkIsPurchased(p)),
        },
        {
            title: 'Cancelled',
            data: activePlans.filter(p => p.status === 'Cancel'),
        }
    ].filter(s => s.data.length > 0);

    return (
        <View style={[styles.container, (isPurchaseModalVisible || isAddModalVisible || previewImage || !!selectedPlan || choiceModalVisible) && styles.dimmedContainer]}>
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <PurchasePlanCard
                        item={item}
                        onStatusUpdate={handleStatusUpdate}
                        onImagePress={setPreviewImage}
                        onDetailsPress={setSelectedPlan}
                        onAddPurchase={(plan) => {
                            setSelectedPlan(plan);
                            setIsPurchaseModalVisible(true);
                        }}
                        isAlreadyEntered={checkIsPurchased(item)}
                    />
                )}
                renderSectionHeader={({ section: { title, data } }) => (
                    <View style={styles.sectionHeader}>
                        <Text style={[
                            styles.sectionTitle,
                            title === 'Cancelled' && styles.sectionTitleCancelled
                        ]}>{title} ({data.length})</Text>
                    </View>
                )}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={onRefresh} colors={[Colors.primary]} />
                }
                stickySectionHeadersEnabled={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No purchase plans available</Text>
                    </View>
                }
            />

            {/* Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setIsAddModalVisible(true)}
                activeOpacity={0.8}
            >
                <Plus size={30} color={Colors.primary} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Image Preview Modal */}
            <Modal
                visible={!!previewImage}
                transparent={true}
                onRequestClose={() => setPreviewImage(null)}
                animationType="fade"
                statusBarTranslucent={true}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalCloseArea}
                        onPress={() => setPreviewImage(null)}
                    />
                    <View style={styles.modalContent}>
                        <Image
                            source={{ uri: previewImage || '' }}
                            style={styles.fullImage}
                            resizeMode="contain"
                        />
                        <TouchableOpacity
                            style={styles.closeAreaAbsolute}
                            onPress={() => setPreviewImage(null)}
                        >
                            <X size={30} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <AddPurchasePlanModal
                visible={isAddModalVisible}
                onClose={() => setIsAddModalVisible(false)}
                onSave={handleSavePlan}
            />

            {/* Status Choice Modal */}
            <Modal
                visible={choiceModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setChoiceModalVisible(false)}
            >
                <View style={styles.choiceModalOverlay}>
                    <View style={styles.choiceModalContent}>
                        <TouchableOpacity
                            style={styles.choiceCloseButton}
                            onPress={() => setChoiceModalVisible(false)}
                        >
                            <X size={20} color="#4A5568" />
                        </TouchableOpacity>

                        <Text style={styles.choiceTitle}>Complete Plan</Text>
                        <Text style={styles.choiceSubtitle}>How would you like to complete this plan?</Text>

                        <View style={styles.choiceButtonRow}>
                            <TouchableOpacity
                                style={[styles.choiceButton, styles.choiceDoneButton]}
                                onPress={() => handleChoiceSelection('Done')}
                            >
                                <Check size={20} color="#FFFFFF" />
                                <Text style={styles.choiceDoneText}>Done</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.choiceButton, styles.choiceEntryButton]}
                                onPress={() => handleChoiceSelection('Entry')}
                            >
                                <Plus size={20} color="#FFFFFF" />
                                <Text style={styles.choiceEntryText}>Entry</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <PurchasePlanDetailsModal
                visible={!!selectedPlan && !isPurchaseModalVisible}
                onClose={() => setSelectedPlan(null)}
                plan={selectedPlan}
            />

            <AddPurchaseModal
                visible={isPurchaseModalVisible}
                onClose={() => {
                    setIsPurchaseModalVisible(false);
                    setSelectedPlan(null);
                }}
                planData={selectedPlan}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    dimmedContainer: {
        opacity: 0.3,
        backgroundColor: '#000000',
    },
    listContainer: {
        padding: Spacing.sm,
    },
    sectionHeader: {
        paddingVertical: 6,
        paddingHorizontal: 4,
        marginBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2D3748',
    },
    sectionTitleCancelled: {
        color: '#C53030', // Red for cancelled section
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 0,
        marginBottom: Spacing.md,
        overflow: 'hidden',
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
        paddingVertical: 6,
    },
    countdownText: {
        fontSize: 14,
        color: '#2B6CB0', // Blue
        fontWeight: '500',
    },
    topPriceText: {
        fontSize: 14,
        color: '#000000',
    },
    dividerDashed: {
        height: 1,
        width: '100%',
        borderTopWidth: 1,
        borderColor: '#CBD5E0',
        borderStyle: 'dashed',
        marginTop: 5,
        marginBottom: 5,
    },
    dividerSolid: {
        height: 1,
        backgroundColor: '#000000',
        marginHorizontal: 10,
    },
    cardMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
        gap: 10,
    },
    imageContainer: {
        width: 50,
        height: 50,
        borderWidth: 1,
        borderColor: '#EDF2F7',
        borderRadius: 4,
        overflow: 'hidden',
    },
    productImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#F7FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    productNameText: {
        flex: 1,
        fontSize: 14,
        color: '#3182CE', // Blue
        fontWeight: '600',
    },
    productInfoArea: {
        flex: 1,
        justifyContent: 'center',
        paddingVertical: 8,
        alignSelf: 'stretch',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    infoBlock: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    infoLabel: {
        fontSize: 13,
        color: '#718096',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#000000',
        marginLeft: 4,
    },
    cardActions: {
        padding: 8,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        height: 38,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1,
    },
    completeButton: {
        backgroundColor: '#EDF2F7',
        borderColor: '#CBD5E0',
    },
    completeButtonText: {
        fontSize: 14,
        color: '#2D3748',
    },
    cancelButton: {
        backgroundColor: '#FFF5F5',
        borderColor: '#FED7D7',
    },
    cancelButtonText: {
        fontSize: 14,
        color: '#C53030',
    },
    addPurchaseBigButton: {
        backgroundColor: '#00A651', // Green from screenshot
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addPurchaseBigButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
    entryDoneButton: {
        backgroundColor: '#E2E8F0', // Light grey
        borderColor: '#CBD5E0',
        borderWidth: 1,
    },
    entryDoneText: {
        color: '#2F855A', // Dark green text
    },
    entryDoneTextPrimary: {
        color: '#2F855A',
    },
    purchasedCard: {
        backgroundColor: '#F0FFF4', // Light green highlight
        borderColor: '#C6F6D5',
    },
    cancelledBadgeWide: {
        backgroundColor: '#FFF5F5',
        height: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FED7D7',
    },
    cancelledTextWide: {
        color: '#C53030',
        fontWeight: 'bold',
        fontSize: 14,
    },
    emptyContainer: {
        marginTop: 100,
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.textSecondary,
        fontSize: 16,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 56,
        height: 56,
        backgroundColor: Colors.primarySoft,
        borderRadius: Radius.md,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 6,
        borderWidth: 1,
        borderColor: '#E3F2FD',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCloseArea: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalContent: {
        width: '90%',
        height: '70%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImage: {
        width: '100%',
        height: '100%',
    },
    closeButton: {
        position: 'absolute',
        top: -40,
        right: 0,
        padding: 10,
    },
    closeAreaAbsolute: {
        position: 'absolute',
        top: 20,
        right: 20,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 25,
    },
    // Details Modal Styles
    detailsModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)', // Slightly darker for better contrast
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
    },
    detailsModalContent: {
        width: '94%',
        maxHeight: '90%',
        backgroundColor: '#FFFFFF',
        borderRadius: Radius.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
        overflow: 'hidden',
    },
    detailsHeaderSticky: {
        padding: Spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        zIndex: 10,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    detailsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D3748',
    },
    modalScrollBody: {
        backgroundColor: '#FFFFFF',
    },
    modalBodyPadding: {
        padding: Spacing.md,
    },
    detailsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    detailsItem: {
        flex: 1,
    },
    detailsLabel: {
        fontSize: 14,
        color: '#718096',
        marginBottom: 4,
    },
    detailsLabelBlack: {
        fontSize: 14,
        color: '#000000',
        fontWeight: 'bold',
        marginBottom: 6,
    },
    detailsValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailsValue: {
        fontSize: 16,
        color: '#2D3748',
        fontWeight: '500',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusBadgeText: {
        fontSize: 14,
        fontWeight: '600',
    },
    remarksSection: {
        marginBottom: Spacing.md,
    },
    remarksBox: {
        backgroundColor: '#F8FAFC',
        padding: Spacing.sm,
        borderRadius: Radius.sm,
        marginTop: 4,
    },
    remarksText: {
        color: '#2D3748',
        fontSize: 15,
    },
    detailsDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: Spacing.md,
    },
    sectionTitleSmall: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: Spacing.sm,
    },
    analysisGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    analysisCard: {
        flex: 1,
        padding: Spacing.sm,
        borderWidth: 1,
        borderRadius: Radius.sm,
    },
    latestCard: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    lowCard: {
        backgroundColor: '#F0FDF4',
        borderColor: '#22C55E',
    },
    analysisLabelBlue: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#2563EB',
        marginBottom: 4,
    },
    analysisLabelGreen: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#16A34A',
        marginBottom: 4,
    },
    analysisPrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 2,
    },
    analysisSupplier: {
        fontSize: 11,
        color: '#718096',
    },
    // Tabular History Styles
    historyTable: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 4,
        overflow: 'hidden',
        marginTop: 5,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    tableHeaderText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#2D3748',
    },
    tableBodyRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        alignItems: 'center',
    },
    tableCellText: {
        fontSize: 11,
        color: '#2D3748',
    },
    noHistoryContainer: {
        padding: 20,
        alignItems: 'center',
    },
    noHistoryText: {
        color: '#718096',
        fontStyle: 'italic',
        fontSize: 13,
    },
    detailsFooterSticky: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: Spacing.md,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        // Sticky shadow effect
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
    },
    modalCloseButtonOutlined: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#CBD5E0',
        borderRadius: 6,
        backgroundColor: '#FFFFFF',
    },
    modalCloseButtonText: {
        color: '#4A5568',
        fontWeight: '600',
        fontSize: 14,
    },
    modalEditButtonFilled: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    modalEditButtonText: {
        color: '#374151',
        fontWeight: '600',
        fontSize: 14,
    },
    // Add Modal Specific Styles
    headerAddButton: {
        padding: 4,
    },
    formRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
    },
    formField: {
        flex: 1,
    },
    formFieldFull: {
        width: '100%',
        marginBottom: 16,
    },
    formInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        marginTop: 4,
        backgroundColor: '#FFFFFF',
    },
    formInputText: {
        fontSize: 15,
        color: '#2D3748',
        flex: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    productDropdown: {
        position: 'absolute',
        top: 68,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 2000,
    },
    statusDropdown: {
        position: 'absolute',
        top: 68,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 2000,
    },
    dropdownOption: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F7FAFC',
    },
    dropdownOptionText: {
        fontSize: 15,
        color: '#2D3748',
    },
    searchInputWrapper: {
        flexDirection: 'column',
    },
    productItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F7FAFC',
    },
    productItemText: {
        fontSize: 14,
        color: '#2D3748',
        fontWeight: '500',
    },
    productItemSku: {
        fontSize: 12,
        color: '#718096',
        marginTop: 2,
    },
    statsCard: {
        backgroundColor: '#F7FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statsItem: {
        flex: 1,
    },
    statsLabel: {
        fontSize: 12,
        color: '#718096',
        marginBottom: 4,
    },
    statsPrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D3748',
    },
    statsSupplier: {
        fontSize: 11,
        color: '#A0AEC0',
        marginTop: 2,
    },
    modalCancelButton: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
    },
    modalCancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#4A5568',
    },
    modalSaveButton: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: '#2563EB',
        borderRadius: 8,
    },
    modalSaveButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Choice Modal Styles
    choiceModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    choiceModalContent: {
        width: '85%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    choiceCloseButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        padding: 4,
    },
    choiceTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 8,
    },
    choiceSubtitle: {
        fontSize: 15,
        color: '#718096',
        textAlign: 'center',
        marginBottom: 24,
    },
    choiceButtonRow: {
        flexDirection: 'row',
        gap: 16,
        width: '100%',
    },
    choiceButton: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    choiceDoneButton: {
        backgroundColor: '#48BB78', // Success Green
    },
    choiceDoneText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    choiceEntryButton: {
        backgroundColor: Colors.primary, // App Blue
    },
    choiceEntryText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
