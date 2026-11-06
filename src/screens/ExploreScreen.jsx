import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
export default function TabTwoScreen() {
    const safeAreaInsets = useSafeAreaInsets();
    const insets = {
        ...safeAreaInsets,
        bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
    };
    const theme = useTheme();
    const contentPlatformStyle = Platform.select({
        android: {
            paddingTop: insets.top,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            paddingBottom: insets.bottom,
        },
        web: {
            paddingTop: Spacing.six,
            paddingBottom: Spacing.four,
        },
    });
    return (_jsx(ScrollView, { style: [styles.scrollView, { backgroundColor: theme.background }], contentInset: insets, contentContainerStyle: [styles.contentContainer, contentPlatformStyle], children: _jsxs(ThemedView, { style: styles.container, children: [_jsxs(ThemedView, { style: styles.titleContainer, children: [_jsx(ThemedText, { type: "subtitle", children: "Explore" }), _jsxs(ThemedText, { style: styles.centerText, themeColor: "textSecondary", children: ["This starter app includes example", '\n', "code to help you get started."] }), _jsx(ExternalLink, { href: "https://docs.expo.dev", asChild: true, children: _jsx(Pressable, { style: ({ pressed }) => pressed && styles.pressed, children: _jsxs(ThemedView, { type: "backgroundElement", style: styles.linkButton, children: [_jsx(ThemedText, { type: "link", children: "Expo documentation" }), _jsx(SymbolView, { tintColor: theme.text, name: { ios: 'arrow.up.right.square', android: 'link', web: 'link' }, size: 12 })] }) }) })] }), _jsxs(ThemedView, { style: styles.sectionsWrapper, children: [_jsxs(Collapsible, { title: "File-based routing", children: [_jsxs(ThemedText, { type: "small", children: ["This app has two screens: ", _jsx(ThemedText, { type: "code", children: "src/app/index.tsx" }), " and", ' ', _jsx(ThemedText, { type: "code", children: "src/app/explore.tsx" })] }), _jsxs(ThemedText, { type: "small", children: ["The layout file in ", _jsx(ThemedText, { type: "code", children: "src/app/_layout.tsx" }), " sets up the tab navigator."] }), _jsx(ExternalLink, { href: "https://docs.expo.dev/router/introduction", children: _jsx(ThemedText, { type: "linkPrimary", children: "Learn more" }) })] }), _jsx(Collapsible, { title: "Android, iOS, and web support", children: _jsxs(ThemedView, { type: "backgroundElement", style: styles.collapsibleContent, children: [_jsxs(ThemedText, { type: "small", children: ["You can open this project on Android, iOS, and the web. To open the web version, press ", _jsx(ThemedText, { type: "smallBold", children: "w" }), " in the terminal running this project."] }), _jsx(Image, { source: require('@/assets/images/tutorial-web.png'), style: styles.imageTutorial })] }) }), _jsxs(Collapsible, { title: "Images", children: [_jsxs(ThemedText, { type: "small", children: ["For static images, you can use the ", _jsx(ThemedText, { type: "code", children: "@2x" }), " and", ' ', _jsx(ThemedText, { type: "code", children: "@3x" }), " suffixes to provide files for different screen densities."] }), _jsx(Image, { source: require('@/assets/images/react-logo.png'), style: styles.imageReact }), _jsx(ExternalLink, { href: "https://reactnative.dev/docs/images", children: _jsx(ThemedText, { type: "linkPrimary", children: "Learn more" }) })] }), _jsxs(Collapsible, { title: "Light and dark mode components", children: [_jsxs(ThemedText, { type: "small", children: ["This template has light and dark mode support. The", ' ', _jsx(ThemedText, { type: "code", children: "useColorScheme()" }), " hook lets you inspect what the user's current color scheme is, and so you can adjust UI colors accordingly."] }), _jsx(ExternalLink, { href: "https://docs.expo.dev/develop/user-interface/color-themes/", children: _jsx(ThemedText, { type: "linkPrimary", children: "Learn more" }) })] }), _jsx(Collapsible, { title: "Animations", children: _jsxs(ThemedText, { type: "small", children: ["This template includes an example of an animated component. The", ' ', _jsx(ThemedText, { type: "code", children: "src/components/ui/collapsible.tsx" }), " component uses the powerful ", _jsx(ThemedText, { type: "code", children: "react-native-reanimated" }), " library to animate opening this hint."] }) })] }), Platform.OS === 'web' && _jsx(WebBadge, {})] }) }));
}
const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    container: {
        maxWidth: MaxContentWidth,
        flexGrow: 1,
    },
    titleContainer: {
        gap: Spacing.three,
        alignItems: 'center',
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.six,
    },
    centerText: {
        textAlign: 'center',
    },
    pressed: {
        opacity: 0.7,
    },
    linkButton: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.two,
        borderRadius: Spacing.five,
        justifyContent: 'center',
        gap: Spacing.one,
        alignItems: 'center',
    },
    sectionsWrapper: {
        gap: Spacing.five,
        paddingHorizontal: Spacing.four,
        paddingTop: Spacing.three,
    },
    collapsibleContent: {
        alignItems: 'center',
    },
    imageTutorial: {
        width: '100%',
        aspectRatio: 296 / 171,
        borderRadius: Spacing.three,
        marginTop: Spacing.two,
    },
    imageReact: {
        width: 100,
        height: 100,
        alignSelf: 'center',
    },
});
