import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import HomeScreen    from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ReaderScreen  from './src/features/reader/ReaderScreenV2';
import BookInfoScreen from './src/screens/BookInfoScreen';
import MergeOrderScreen from './src/screens/MergeOrderScreen';
import { useThemeStore } from './src/store/useThemeStore';

import { DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';

const Drawer = createDrawerNavigator();
const Root   = createNativeStackNavigator();

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { theme } = useThemeStore();
  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
      <View style={{ marginTop: 8, paddingHorizontal: 14 }}>
        <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 8 }} />
        <TouchableOpacity
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingVertical: 12, paddingHorizontal: 16,
            borderRadius: 8,
          }}
          onPress={() => {
            props.navigation.closeDrawer();
            props.navigation.navigate('Home', { mergeMode: true });
          }}
        >
          <Text style={{ color: theme.textSecondary, fontSize: 14, fontWeight: '500' }}>📎 Birleştir</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

/**
 * Drawer Navigator — Sadece Kitaplık ve Ayarlar görünür.
 * Reader buraya dahil DEĞİL; tam ekran deneyimi için Root Stack'te.
 */
function DrawerNavigator() {
  const { theme } = useThemeStore();
  
  return (
    <Drawer.Navigator 
      initialRouteName="Home"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
        headerTintColor: theme.textPrimary,
        drawerStyle: { backgroundColor: theme.surface },
        drawerActiveTintColor: theme.primary,
        drawerInactiveTintColor: theme.textSecondary,
        drawerActiveBackgroundColor: theme.primaryLight,
      }}
    >
      <Drawer.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Raflarım / Kitaplık', headerShown: false }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Ayarlar' }}
      />
    </Drawer.Navigator>
  );
}

/**
 * Root Stack — En dış katman.
 * DrawerNavigator + Reader burada yaşıyor.
 * Reader açıldığında Drawer başlığı / arka plan tamamen devre dışı kalıyor.
 */
export default function App() {
  const { isDarkMode, theme } = useThemeStore();
  
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setPositionAsync('absolute');
      NavigationBar.setBackgroundColorAsync('transparent');
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar 
          style={isDarkMode ? 'light' : 'dark'} 
          backgroundColor="transparent"
          translucent={true}
        />
        <NavigationContainer>
          <Root.Navigator screenOptions={{ headerShown: false }}>
            {/* Kitaplık / Drawer ekranı */}
            <Root.Screen name="DrawerRoot" component={DrawerNavigator} />

            {/* Okuyucu — Drawer dışında, tam ekran */}
            <Root.Screen name="Reader" component={ReaderScreen} />

            {/* Künye Ekranı */}
            <Root.Screen name="BookInfo" component={BookInfoScreen} />

            {/* Birleştirme Sıralama Ekranı */}
            <Root.Screen name="MergeOrder" component={MergeOrderScreen} />
          </Root.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
