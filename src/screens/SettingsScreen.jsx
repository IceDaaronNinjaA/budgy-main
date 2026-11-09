
import { ScrollView, StyleSheet, View, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Reusable clickable setting row
function SettingRow({ icon, title, subtitle, value, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingRow,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.iconBox}>
        <ThemedText style={styles.icon}>{icon}</ThemedText>
      </View>

      <View style={styles.rowContent}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>

      {value ? (
        <ThemedText type="small" themeColor="textSecondary">
          {value}
        </ThemedText>
      ) : null}

      {onPress ? (
        <ThemedText themeColor="textSecondary" style={styles.arrow}>
          ›
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();

  // Show the device's current time zone
  const handleTimeZone = () => {
    const timeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone;

    Alert.alert('Time Zone', `Your current time zone is ${timeZone}.`);
  };

  // Currency is USD for the current version
  const handleCurrency = () => {
    Alert.alert(
      'Currency',
      'Budgy currently uses USD ($) as its currency.'
    );
  };

  // Navigate to the Budgets screen
  const handleBudgets = () => {
    router.push('/budgets');
  };

  // Recurring rules are not implemented yet
  const handleRecurringRules = () => {
    Alert.alert(
      'Recurring Rules',
      'Recurring rule management is not available yet.'
    );
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="subtitle" style={styles.heading}>
            Profile & Settings
          </ThemedText>

          <ThemedText themeColor="textSecondary">
            Manage your account and preferences.
          </ThemedText>

          {/* Profile */}
          <ThemedView type="backgroundElement" style={styles.profileCard}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>B</ThemedText>
            </View>

            <View style={styles.rowContent}>
              <ThemedText type="smallBold">My Profile</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Manage your Budgy preferences
              </ThemedText>
              <ThemedText type="small" style={styles.memberLabel}>
                Budgy member
              </ThemedText>
            </View>
          </ThemedView>

          {/* Preferences */}
          <ThemedText
            type="smallBold"
            themeColor="textSecondary"
            style={styles.sectionTitle}
          >
            PREFERENCES
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            <SettingRow
              icon="🌎"
              title="Time Zone"
              subtitle="View your current time zone"
              value="Device"
              onPress={handleTimeZone}
            />

            <View style={styles.divider} />

            <SettingRow
              icon="💵"
              title="Currency"
              subtitle="Choose your preferred currency"
              value="USD"
              onPress={handleCurrency}
            />
          </ThemedView>

          {/* Budget Management */}
          <ThemedText
            type="smallBold"
            themeColor="textSecondary"
            style={styles.sectionTitle}
          >
            BUDGET MANAGEMENT
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            <SettingRow
              icon="💰"
              title="Budgets"
              subtitle="Manage your budgets"
              onPress={handleBudgets}
            />

            <View style={styles.divider} />

            <SettingRow
              icon="🔄"
              title="Recurring Rules"
              subtitle="Manage recurring transactions"
              onPress={handleRecurringRules}
            />
          </ThemedView>

          {/* Footer */}
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.footer}
          >
            Budgy • Your money, made clearer
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 120,
  },
  heading: {
    fontSize: 28,
    marginBottom: 6,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    gap: 14,
    marginTop: 24,
    marginBottom: 28,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#DCEFE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#26734D',
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  memberLabel: {
    color: '#26734D',
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    gap: 12,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 19,
  },
  arrow: {
    fontSize: 25,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(128,128,128,0.25)',
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
  },
});
