
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

// Reusable row for each setting
function SettingRow({ icon, title, subtitle, value }) {
  return (
    <View style={styles.settingRow}>
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

      <ThemedText themeColor="textSecondary" style={styles.arrow}>
        ›
      </ThemedText>
    </View>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Page heading */}
          <ThemedText type="subtitle" style={styles.heading}>
            Profile & Settings
          </ThemedText>

          <ThemedText themeColor="textSecondary">
            Manage your account and preferences.
          </ThemedText>

          {/* Profile card */}
          <ThemedView type="backgroundElement" style={styles.profileCard}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>LJ</ThemedText>
            </View>

            <View style={styles.rowContent}>
              <ThemedText type="smallBold">
                Lucas Johnson
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                lucas@example.com
              </ThemedText>
              <ThemedText type="small" style={styles.memberLabel}>
                Budgy member
              </ThemedText>
            </View>

            <ThemedText themeColor="textSecondary" style={styles.arrow}>
              ›
            </ThemedText>
          </ThemedView>

          {/* Appearance */}
          <ThemedText type="smallBold" themeColor="textSecondary"
            style={styles.sectionTitle}>
            PREFERENCES
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            <SettingRow
              icon="🎨"
              title="Appearance"
              subtitle="Customize how Budgy looks"
              value="System"
            />
          </ThemedView>

          {/* Security and privacy */}
          <ThemedText type="smallBold" themeColor="textSecondary"
            style={styles.sectionTitle}>
            SECURITY & PRIVACY
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            <SettingRow
              icon="🔒"
              title="Password & Security"
              subtitle="Manage account security"
            />

            <View style={styles.divider} />

            <SettingRow
              icon="🛡️"
              title="Privacy"
              subtitle="Manage privacy preferences"
            />
          </ThemedView>

          {/* Account */}
          <ThemedText type="smallBold" themeColor="textSecondary"
            style={styles.sectionTitle}>
            ACCOUNT
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            <SettingRow
              icon="↪"
              title="Log Out"
              subtitle="Sign out of your account"
            />
          </ThemedView>

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
    backgroundColor: '#4B5563',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  memberLabel: {
    color: '#16A34A',
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 10,
  },
  card: {
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  settingRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(156, 163, 175, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 19,
  },
  arrow: {
    fontSize: 25,
    marginLeft: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#9CA3AF',
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
  },
});
