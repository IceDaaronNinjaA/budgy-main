import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Tabs, TabList, TabTrigger, TabSlot, } from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, useColorScheme, View, StyleSheet } from 'react-native';
import { ExternalLink } from './external-link';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
export default function AppTabs() {
    return (_jsxs(Tabs, { children: [_jsx(TabSlot, { style: { height: '100%' } }), _jsx(TabList, { asChild: true, children: _jsxs(CustomTabList, { children: [_jsx(TabTrigger, { name: "home", href: "/", asChild: true, children: _jsx(TabButton, { children: "Home" }) }), _jsx(TabTrigger, { name: "explore", href: "/explore", asChild: true, children: _jsx(TabButton, { children: "Explore" }) })] }) })] }));
}
export function TabButton({ children, isFocused, ...props }) {
    return (_jsx(Pressable, { ...props, style: ({ pressed }) => pressed && styles.pressed, children: _jsx(ThemedView, { type: isFocused ? 'backgroundSelected' : 'backgroundElement', style: styles.tabButtonView, children: _jsx(ThemedText, { type: "small", themeColor: isFocused ? 'text' : 'textSecondary', children: children }) }) }));
}
export function CustomTabList(props) {
    const scheme = useColorScheme();
    const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
    return (_jsx(View, { ...props, style: styles.tabListContainer, children: _jsxs(ThemedView, { type: "backgroundElement", style: styles.innerContainer, children: [_jsx(ThemedText, { type: "smallBold", style: styles.brandText, children: "Expo Starter" }), props.children, _jsx(ExternalLink, { href: "https://docs.expo.dev", asChild: true, children: _jsxs(Pressable, { style: styles.externalPressable, children: [_jsx(ThemedText, { type: "link", children: "Docs" }), _jsx(SymbolView, { tintColor: colors.text, name: { ios: 'arrow.up.right.square', web: 'link' }, size: 12 })] }) })] }) }));
}
const styles = StyleSheet.create({
    tabListContainer: {
        position: 'absolute',
        width: '100%',
        padding: Spacing.three,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    innerContainer: {
        paddingVertical: Spacing.two,
        paddingHorizontal: Spacing.five,
        borderRadius: Spacing.five,
        flexDirection: 'row',
        alignItems: 'center',
        flexGrow: 1,
        gap: Spacing.two,
        maxWidth: MaxContentWidth,
    },
    brandText: {
        marginRight: 'auto',
    },
    pressed: {
        opacity: 0.7,
    },
    tabButtonView: {
        paddingVertical: Spacing.one,
        paddingHorizontal: Spacing.three,
        borderRadius: Spacing.three,
    },
    externalPressable: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.one,
        marginLeft: Spacing.three,
    },
});
