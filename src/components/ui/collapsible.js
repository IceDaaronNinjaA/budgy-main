import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
export function Collapsible({ children, title }) {
    const [isOpen, setIsOpen] = useState(false);
    const theme = useTheme();
    return (_jsxs(ThemedView, { children: [_jsxs(Pressable, { style: ({ pressed }) => [styles.heading, pressed && styles.pressedHeading], onPress: () => setIsOpen((value) => !value), children: [_jsx(ThemedView, { type: "backgroundElement", style: styles.button, children: _jsx(SymbolView, { name: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }, size: 14, weight: "bold", tintColor: theme.text, style: { transform: [{ rotate: isOpen ? '-90deg' : '90deg' }] } }) }), _jsx(ThemedText, { type: "small", children: title })] }), isOpen && (_jsx(Animated.View, { entering: FadeIn.duration(200), children: _jsx(ThemedView, { type: "backgroundElement", style: styles.content, children: children }) }))] }));
}
const styles = StyleSheet.create({
    heading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.two,
    },
    pressedHeading: {
        opacity: 0.7,
    },
    button: {
        width: Spacing.four,
        height: Spacing.four,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        marginTop: Spacing.three,
        borderRadius: Spacing.three,
        marginLeft: Spacing.four,
        padding: Spacing.four,
    },
});
