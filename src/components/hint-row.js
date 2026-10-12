import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
export function HintRow({ title = 'Try editing', hint = 'app/index.js' }) {
    return (_jsxs(View, { style: styles.stepRow, children: [_jsx(ThemedText, { type: "small", children: title }), _jsx(ThemedView, { type: "backgroundSelected", style: styles.codeSnippet, children: _jsx(ThemedText, { themeColor: "textSecondary", children: hint }) })] }));
}
const styles = StyleSheet.create({
    stepRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    codeSnippet: {
        borderRadius: Spacing.two,
        paddingVertical: Spacing.half,
        paddingHorizontal: Spacing.two,
    },
});
