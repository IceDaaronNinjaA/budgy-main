import { jsx as _jsx } from "react/jsx-runtime";
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
export default function SettingsScreen() {
    return _jsx(ThemedView, { style: { flex: 1, alignItems: 'center', justifyContent: 'center' }, children: _jsx(ThemedText, { type: "title", children: "Settings" }) });
}
