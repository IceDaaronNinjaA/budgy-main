import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';
export default function AppTabs() {
    const scheme = useColorScheme();
    const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
    return (_jsxs(NativeTabs, { backgroundColor: colors.background, indicatorColor: colors.backgroundElement, labelStyle: { selected: { color: colors.text } }, children: [_jsxs(NativeTabs.Trigger, { name: "index", children: [_jsx(NativeTabs.Trigger.Label, { children: "Dashboard" }), _jsx(NativeTabs.Trigger.Icon, { sf: "house.fill", md: "home" })] }), _jsxs(NativeTabs.Trigger, { name: "transactions", children: [_jsx(NativeTabs.Trigger.Label, { children: "Transactions" }), _jsx(NativeTabs.Trigger.Icon, { sf: "list.bullet", md: "receipt_long" })] }), _jsxs(NativeTabs.Trigger, { name: "budgets", children: [_jsx(NativeTabs.Trigger.Label, { children: "Budgets" }), _jsx(NativeTabs.Trigger.Icon, { sf: "chart.bar.fill", md: "account_balance_wallet" })] }), _jsxs(NativeTabs.Trigger, { name: "goals", children: [_jsx(NativeTabs.Trigger.Label, { children: "Goals" }), _jsx(NativeTabs.Trigger.Icon, { sf: "target", md: "flag" })] }), _jsxs(NativeTabs.Trigger, { name: "settings", children: [_jsx(NativeTabs.Trigger.Label, { children: "Settings" }), _jsx(NativeTabs.Trigger.Icon, { sf: "gearshape.fill", md: "settings" })] })] }));
}
