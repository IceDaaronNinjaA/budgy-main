import { StyleSheet } from 'react-native';

/**
 * Shared layout styles for screens and reusable card-based UI.
 * Keep colors in ThemedView/ThemedText so these styles work with light and dark themes.
 */
export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 120,
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: 18,
    padding: 16,
  },
  icon: {
    width: 40,
    height: 40,
  },
});
