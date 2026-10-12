import { jsx as _jsx } from "react/jsx-runtime";
import { View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }) {
    const theme = useTheme();
    return _jsx(View, { style: [{ backgroundColor: theme[type ?? 'background'] }, style], ...otherProps });
}
