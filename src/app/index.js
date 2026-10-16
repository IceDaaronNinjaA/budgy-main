import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const transactions = [
  { icon: '🛒', name: 'Grocery Market', category: 'Food', amount: '-$48.20' },
  { icon: '🚌', name: 'City Transit', category: 'Transport', amount: '-$32.50' },
  { icon: '💰', name: 'Monthly paycheck', category: 'Income', amount: '+$2,840.00' },
];

export default function HomeScreen() {
  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle" style={styles.title}>Good morning, Lucas</ThemedText>
          <ThemedText themeColor="textSecondary">Here is your money snapshot.</ThemedText>

          <ThemedView style={styles.balanceCard}>
            <ThemedText type="small" style={styles.cardLabel}>TOTAL BALANCE</ThemedText>
            <ThemedText style={styles.balance}>$4,268.42</ThemedText>
            <ThemedText style={styles.positive}>+$320.15 this month</ThemedText>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
            <View style={styles.cardFooter}>
              <ThemedText type="small" style={styles.cardLabel}>Monthly spending</ThemedText>
              <ThemedText type="smallBold" style={styles.cardLabel}>$1,240 / $2,000</ThemedText>
            </View>
          </ThemedView>

          <View style={styles.statsRow}>
            <ThemedView type="backgroundElement" style={styles.statCard}>
              <ThemedText type="small" themeColor="textSecondary">INCOME</ThemedText>
              <ThemedText style={styles.statValue}>$2,840</ThemedText>
              <ThemedText type="small" style={styles.income}>This month</ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.statCard}>
              <ThemedText type="small" themeColor="textSecondary">EXPENSES</ThemedText>
              <ThemedText style={styles.statValue}>$1,240</ThemedText>
              <ThemedText type="small" style={styles.expense}>This month</ThemedText>
            </ThemedView>
          </View>

          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Recent activity</ThemedText>
            <ThemedText type="linkPrimary">See all</ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.transactionCard}>
            {transactions.map((transaction, index) => (
              <View key={transaction.name} style={[styles.transactionRow, index > 0 && styles.divider]}>
                <View style={styles.transactionIcon}><ThemedText>{transaction.icon}</ThemedText></View>
                <View style={styles.transactionInfo}>
                  <ThemedText type="smallBold">{transaction.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{transaction.category}</ThemedText>
                </View>
                <ThemedText type="smallBold" style={transaction.amount.startsWith('+') ? styles.income : undefined}>
                  {transaction.amount}
                </ThemedText>
              </View>
            ))}
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.tipCard}>
            <ThemedText style={styles.tipIcon}>💡</ThemedText>
            <View style={styles.tipText}>
              <ThemedText type="smallBold">Small tip</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Try saving 10% of your income this month.</ThemedText>
            </View>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: 24, paddingBottom: 120, gap: 8 },
  title: { marginTop: 4, marginBottom: 4, fontSize: 30 },
  balanceCard: { marginTop: 24, padding: 24, borderRadius: 22, backgroundColor: '#4B5563', gap: 8 },
  cardLabel: { color: '#E5E7EB' },
  balance: { color: '#ffffff', fontSize: 38, lineHeight: 48, fontWeight: '700', marginVertical: 4, flexShrink: 0 },
  positive: { color: '#F3F4F6', fontSize: 14, fontWeight: '700' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#6B7280', overflow: 'hidden', marginTop: 16 },
  progressFill: { width: '62%', height: '100%', borderRadius: 4, backgroundColor: '#D1D5DB' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  statCard: { flex: 1, padding: 16, borderRadius: 18, gap: 8 },
  statValue: { fontSize: 23, fontWeight: '700' },
  income: { color: '#374151' },
  expense: { color: '#6B7280' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 8 },
  sectionTitle: { fontSize: 22 },
  transactionCard: { borderRadius: 18, paddingHorizontal: 16 },
  transactionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#c9cbd0' },
  transactionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  transactionInfo: { flex: 1, gap: 2 },
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, marginTop: 12 },
  tipIcon: { fontSize: 24 },
  tipText: { flex: 1, gap: 2 },
});
