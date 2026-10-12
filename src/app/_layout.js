import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
SplashScreen.preventAutoHideAsync();
export default function TabLayout() {
    const colorScheme = useColorScheme();
    return (_jsxs(ThemeProvider, { value: colorScheme === 'dark' ? DarkTheme : DefaultTheme, children: [_jsx(AnimatedSplashOverlay, {}), _jsx(AppTabs, {})] }));
}
