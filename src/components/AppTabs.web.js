import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Tabs, TabList, TabTrigger, TabSlot, } from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
export default function AppTabs() {
    return (_jsxs(Tabs, { children: [_jsx(TabSlot, { style: { height: '100%' } }), _jsx(TabList, { asChild: true, children: _jsxs(CustomTabList, { children: [_jsx(TabTrigger, { name: "home", href: "/", asChild: true, children: _jsx(TabButton, { children: "Home" }) }), _jsx(TabTrigger, { name: "summary", href: "/transactions", asChild: true, children: _jsx(TabButton, { children: "Summary" }) }), _jsx(TabTrigger, { name: "goals", href: "/goals", asChild: true, children: _jsx(TabButton, { children: "Goals" }) }), _jsx(TabTrigger, { name: "profile", href: "/settings", asChild: true, children: _jsx(TabButton, { children: "Profile" }) })] }) })] }));
}
export function TabButton({ children, isFocused, ...props }) {
    return (_jsx(Pressable, { ...props, style: ({ pressed }) => pressed && styles.pressed, children: _jsx(ThemedView, { type: isFocused ? 'backgroundSelected' : 'backgroundElement', style: styles.tabButtonView, children: _jsx(ThemedText, { type: "small", themeColor: isFocused ? 'text' : 'textSecondary', children: children }) }) }));
}
export function CustomTabList(props) {
    return (_jsx(View, { ...props, style: styles.tabListContainer, children: _jsxs(ThemedView, { type: "backgroundElement", style: styles.innerContainer, children: [_jsx(ThemedText, { type: "smallBold", style: styles.brandText, children: "Budgy" }), props.children] }) }));
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
});
