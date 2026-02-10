import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
// We will create these screens next
import DarazDetailScreen from '../screens/DarazDetailScreen';
import StoreSalesDetailScreen from '../screens/StoreSalesDetailScreen';

const Stack = createNativeStackNavigator();

export function HomeStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="HomeMain" component={HomeScreen} />
            <Stack.Screen name="DarazDetail" component={DarazDetailScreen} />
            <Stack.Screen name="StoreSalesDetail" component={StoreSalesDetailScreen} />
        </Stack.Navigator>
    );
}
