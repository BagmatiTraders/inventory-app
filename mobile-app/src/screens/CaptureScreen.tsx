import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useDataStore } from '../store/useDataStore';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { Camera, X, Check, RefreshCcw, Save, Trash2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

export default function CaptureScreen() {
    const navigation = useNavigation();
    const { addCapture, isLoading } = useDataStore();
    const [permission, requestPermission] = useCameraPermissions();
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [price, setPrice] = useState('');
    const [remarks, setRemarks] = useState('');
    const cameraRef = useRef<any>(null);

    useEffect(() => {
        if (!permission) {
            requestPermission();
        }
    }, [permission]);

    if (!permission) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
    }

    if (!permission.granted) {
        return (
            <View style={styles.centered}>
                <Text style={styles.message}>We need your permission to show the camera</Text>
                <TouchableOpacity style={styles.button} onPress={requestPermission}>
                    <Text style={styles.buttonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const takePicture = async () => {
        if (cameraRef.current && isCameraReady) {
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    base64: true,
                    quality: 0.7,
                });
                setCapturedImage(photo.base64);
            } catch (error) {
                Alert.alert('Error', 'Failed to take picture');
            }
        }
    };

    const handleSave = async () => {
        if (!capturedImage) return;

        try {
            await addCapture({
                base64Image: capturedImage,
                price: price ? parseFloat(price) : undefined,
                remarks
            });
            Alert.alert('Success', 'Capture saved successfully');
            setCapturedImage(null);
            setPrice('');
            setRemarks('');
            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', 'Failed to save capture');
        }
    };

    const retake = () => {
        setCapturedImage(null);
    };

    return (
        <View style={styles.container}>
            {!capturedImage ? (
                <View style={styles.cameraContainer}>
                    <CameraView
                        style={styles.camera}
                        ref={cameraRef}
                        onCameraReady={() => setIsCameraReady(true)}
                    >
                        <View style={styles.cameraOverlay}>
                            <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
                                <X size={28} color="#fff" />
                            </TouchableOpacity>

                            <View style={styles.controls}>
                                <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
                                    <View style={styles.captureInner} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </CameraView>
                </View>
            ) : (
                <View style={styles.previewContainer}>
                    <Image
                        source={{ uri: `data:image/jpeg;base64,${capturedImage}` }}
                        style={styles.preview}
                    />

                    <View style={styles.formOverlay}>
                        <View style={styles.formCard}>
                            <View style={styles.formHeader}>
                                <Text style={styles.formTitle}>Capture Details</Text>
                                <TouchableOpacity onPress={retake}>
                                    <RefreshCcw size={20} color={Colors.primary} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.label}>Price (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0.00"
                                keyboardType="decimal-pad"
                                value={price}
                                onChangeText={setPrice}
                            />

                            <Text style={styles.label}>Remarks</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="What is this for?"
                                multiline
                                numberOfLines={2}
                                value={remarks}
                                onChangeText={setRemarks}
                            />

                            <View style={styles.formActions}>
                                <TouchableOpacity
                                    style={styles.cancelBtn}
                                    onPress={retake}
                                    disabled={isLoading}
                                >
                                    <Trash2 size={20} color={Colors.danger} />
                                    <Text style={styles.cancelBtnText}>Discard</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.saveBtn, isLoading && styles.disabledBtn]}
                                    onPress={handleSave}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <Save size={20} color="#fff" />
                                            <Text style={styles.saveBtnText}>Save</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
        padding: 20,
    },
    message: {
        fontSize: 16,
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 20,
    },
    button: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    cameraContainer: {
        flex: 1,
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'space-between',
        padding: 20,
    },
    closeBtn: {
        alignSelf: 'flex-start',
        marginTop: 40,
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 8,
        borderRadius: 20,
    },
    controls: {
        alignItems: 'center',
        marginBottom: 40,
    },
    captureBtn: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 5,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureInner: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#fff',
    },
    previewContainer: {
        flex: 1,
    },
    preview: {
        flex: 1,
        resizeMode: 'cover',
    },
    formOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: Spacing.md,
    },
    formCard: {
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
    },
    formHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    formTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 4,
        marginTop: 8,
    },
    input: {
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.md,
        padding: Spacing.sm,
        fontSize: 16,
        color: Colors.text,
    },
    textArea: {
        height: 60,
        textAlignVertical: 'top',
    },
    formActions: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginTop: Spacing.lg,
    },
    cancelBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.danger,
        borderRadius: Radius.md,
        gap: 8,
    },
    cancelBtnText: {
        color: Colors.danger,
        fontWeight: 'bold',
    },
    saveBtn: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
        backgroundColor: Colors.primary,
        borderRadius: Radius.md,
        gap: 8,
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    disabledBtn: {
        opacity: 0.6,
    }
});
