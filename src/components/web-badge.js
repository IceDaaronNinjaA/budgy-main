import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { version } from 'expo/package.json';
import { Image } from 'expo-image';
import { useColorScheme, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
export function WebBadge() {
    const scheme = useColorScheme();
    return (_jsxs(ThemedView, { style: styles.container, children: [_jsxs(ThemedText, { type: "code", themeColor: "textSecondary", style: styles.versionText, children: ["v", version] }), _jsx(Image, { source: scheme === 'dark'
                    ? require('@/assets/images/expo-badge-white.png')
                    : require('@/assets/images/expo-badge.png'), style: styles.badgeImage })] }));
}
const styles = StyleSheet.create({
    container: {
        padding: Spacing.five,
        alignItems: 'center',
        gap: Spacing.two,
    },
    versionText: {
        textAlign: 'center',
    },
    badgeImage: {
        width: 123,
        aspectRatio: 123 / 24,
    },
});
