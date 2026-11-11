import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/AppTabs';
import AuthScreen from '../screens/AuthScreen';
import { auth } from '../../config/firebase';
import { useEffect, useState } from 'react';
SplashScreen.preventAutoHideAsync();
export default function TabLayout() {
    const colorScheme = useColorScheme();
    const [user, setUser] = useState(undefined);
    useEffect(() => onAuthStateChanged(auth, setUser), []);
    return (_jsxs(ThemeProvider, { value: colorScheme === 'dark' ? DarkTheme : DefaultTheme, children: [_jsx(AnimatedSplashOverlay, {}), user === undefined ? _jsx(View, { style: { flex: 1, alignItems: 'center', justifyContent: 'center' }, children: _jsx(ActivityIndicator, {}) }) : user ? _jsx(AppTabs, {}) : _jsx(AuthScreen, {})] }));
}
