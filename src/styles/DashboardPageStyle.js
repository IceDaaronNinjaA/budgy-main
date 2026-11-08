import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  // Screen structure and scrolling layout.
  screen: { flex: 1, backgroundColor: '#F4F5F2' },
  safeArea: { flex: 1 },
  content: { padding: 24, paddingBottom: 120, gap: 8 },

  // Decorative monster artwork.
  artwork: { width: 100, height: 108, alignItems: 'center', justifyContent: 'center' },
  monsterCircle: {
    width: 90, height: 104, alignItems: 'center', justifyContent: 'center', borderWidth: 3,
    borderColor: '#E0A800', backgroundColor: '#FFC531', borderTopLeftRadius: 62,
    borderTopRightRadius: 62, borderBottomLeftRadius: 42, borderBottomRightRadius: 42,
  },
  petArtwork: { width: 110, height: 122 },

  // Page and supporting text.
  headerBlock: { gap: 0 },
  title: { marginTop: 0, marginBottom: 4, fontSize: 30, fontWeight: '400' },
  mutedText: { fontSize: 16, fontWeight: '400', color: '#6B7280' },

  // Balance card and its header content.
  balanceCard: { marginTop: 24, padding: 24, borderRadius: 25, backgroundColor: '#2B3843', gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { color: '#E5E7EB' },
  balance: { color: '#ffffff', fontSize: 38, lineHeight: 48, fontWeight: '500', marginVertical: 4, flexShrink: 0 },
  positive: { color: '#F3F4F6', fontSize: 14, fontWeight: '700' },

  // Shared card rows and progress indicators.
  statHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  savingGoalCard: { flexDirection: 'row', paddingHorizontal: 15, borderRadius: 25, gap: 8, marginTop: 12, backgroundColor: '#FFFFFF', alignItems: 'center' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#6B7280', overflow: 'hidden', marginTop: 16 },
  progressFill: { width: '62%', height: '100%', borderRadius: 4, backgroundColor: '#FFC531' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  cardButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFC531' },
  cardButtonPressed: { opacity: 0.75 },
  cardButtonText: { color: '#2B3843', fontWeight: '400' },
  cardButtonIcon: { width: 10, height: 10 },

  // Income and expense summary cards.
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, padding: 16, borderRadius: 18, gap: 8, marginTop: 12, backgroundColor: '#FFFFFF' },
  statCardIncome: { flex: 1, padding: 16, borderRadius: 18, gap: 10, marginTop: 12, backgroundColor: '#DCEBE5' },
  statCardExpense: { flex: 1, padding: 16, borderRadius: 18, gap: 10, marginTop: 12, backgroundColor: '#ECE4EB' },
  statValue: { fontSize: 23, fontWeight: '400' },
  statLabel: { fontSize: 18, fontWeight: '400' },
  income: { color: '#374151' },
  expense: { color: '#6B7280' },
  incomeTextCard: { color: '#2F6E5A' },
  expenseTextCard: { color: '#7A5A73' },
  statCardIcon: { width: 45, height: 45, marginBottom: 10 },

  // Section headers and transaction history.
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 8 },
  sectionTitle: { fontSize: 22 },
  transactionCard: { borderRadius: 18, paddingHorizontal: 16 },
  transactionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#c9cbd0' },
  transactionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  transactionInfo: { flex: 1, gap: 2 },

  // Savings goal and tip cards.
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, marginTop: 12 },
  tipIcon: { fontSize: 24 },
  tipText: { flex: 1, gap: 2 },
});

export default styles;
