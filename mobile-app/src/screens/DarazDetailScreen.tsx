import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { useNavigation } from '@react-navigation/native';
import { DarazTabs } from '../navigation/DarazTabs';

export default function DarazDetailScreen() {
    const navigation = useNavigation();

    return (
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
            {/* Nested Tabs Content */}
            <View style={{ flex: 1 }}>
                <DarazTabs />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.background },
});
