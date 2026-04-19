import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen    from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ReaderScreen  from './src/screens/ReaderScreen';
import BookInfoScreen from './src/screens/BookInfoScreen';
import { useThemeStore } from './src/store/useThemeStore';

const Drawer = createDrawerNavigator();
const Root   = createNativeStackNavigator();

/**
 * Drawer Navigator — Sadece Kitaplık ve Ayarlar görünür.
 * Reader buraya dahil DEĞİL; tam ekran deneyimi için Root Stack'te.
 */
function DrawerNavigator() {
  const { theme } = useThemeStore();
  
  return (
    <Drawer.Navigator 
      initialRouteName="Home"
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
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Root.Navigator screenOptions={{ headerShown: false }}>
          {/* Kitaplık / Drawer ekranı */}
          <Root.Screen name="DrawerRoot" component={DrawerNavigator} />

          {/* Okuyucu — Drawer dışında, tam ekran */}
          <Root.Screen name="Reader" component={ReaderScreen} />

          {/* Künye Ekranı */}
          <Root.Screen name="BookInfo" component={BookInfoScreen} />
        </Root.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
