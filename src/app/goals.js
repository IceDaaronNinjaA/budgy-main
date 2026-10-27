import { jsx as _jsx } from "react/jsx-runtime";
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
export default function GoalsScreen() {
    return _jsx(ThemedView, { style: { flex: 1, alignItems: 'center', justifyContent: 'center' }, children: _jsx(ThemedText, { type: "title", children: "Goals" }) });
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
