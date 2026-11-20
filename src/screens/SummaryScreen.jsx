import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { auth } from '../../config/firebase';
import { getTransactions, getAccountSummary } from '@/services/TransactionService';
import {
  aggregateSpendingByMonth,
  aggregateIncomeByMonth,
  incomeSummary,
  isActualExpense,
  isActualIncome,
  spendingSummary,
} from '@/domain/SpendingCalculations';

const COLORS = {
  background: '#FCFCF8',
  navy: '#172A44',
  blue: '#193A66',
  yellow: '#F8E9A7',
  muted: '#87909B',
  border: '#E8E9E4',
  card: '#FFFFFF',
  positive: '#3C7969',
};

function formatMoney(cents, sign = '') {
  const amount = (Number.isSafeInteger(cents) ? cents : 0) / 100;
  return `${sign}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(date) {
  if (!date) return 'Date unavailable';
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function categoryIcon(transaction) {
  const category = `${transaction.categoryId ?? transaction.category ?? ''}`.toLowerCase();
  if (category.includes('food') || category.includes('grocery')) return '🛒';
  if (category.includes('transport') || category.includes('travel')) return '🚗';
  if (category.includes('home') || category.includes('rent')) return '⌂';
  if (category.includes('shop')) return '🛍';
  return '↘';
}

function Chart({ series, width }) {
  // The chart card has 36px of horizontal padding and the y-axis reserves 48px.
  // Keep the plot inside that measured content width so the final point and
  // selected-period highlight cannot spill outside the card.
  const chartWidth = Math.max(220, width - 84);
  const chartHeight = 164;
  const highlightWidth = 42;
  const buckets = series[0].buckets;
  const max = Math.max(...series.flatMap(({ buckets: values }) => values.map((bucket) => bucket.amountCents)), 100);
  const pointsFor = (values) => values.map((bucket, index) => ({
    x: values.length === 1 ? chartWidth / 2 : (chartWidth * index) / (values.length - 1),
    y: chartHeight - 18 - ((bucket.amountCents / max) * (chartHeight - 38)),
  }));
  const points = series.map(({ buckets: values }) => pointsFor(values));
  const selected = points[0].at(-1);
  const highlightLeft = Math.min(
    Math.max(selected.x - highlightWidth / 2, 0),
    chartWidth - highlightWidth
  );
  const gridLines = [0, 0.33, 0.66, 1];

  return (
    <View style={styles.chartShell}>
      <View style={styles.axisLabels}>
        {[1, 0.66, 0.33, 0].map((ratio) => <Text key={ratio} style={styles.axisLabel}>{formatMoney(Math.round(max * ratio))}</Text>)}
      </View>
      <View style={[styles.chart, { width: chartWidth, height: chartHeight }]}>
        {gridLines.map((ratio) => <View key={ratio} style={[styles.gridLine, { top: chartHeight * ratio }]} />)}
        <View style={[styles.selectedBand, { left: highlightLeft, width: highlightWidth, height: chartHeight }]} />
        {series.map((item, seriesIndex) => points[seriesIndex].slice(1).map((point, index) => {
          const previous = points[seriesIndex][index];
          const length = Math.hypot(point.x - previous.x, point.y - previous.y);
          const angle = Math.atan2(point.y - previous.y, point.x - previous.x) * (180 / Math.PI);
          return <View key={`${seriesIndex}-${point.x}-${point.y}`} style={[styles.lineSegment, { backgroundColor: item.color }, {
            width: length,
            left: previous.x,
            top: previous.y,
            transform: [{ rotate: `${angle}deg` }],
          }]} />;
        }))}
        <View style={[styles.tooltip, { left: Math.min(Math.max(selected.x - 34, 4), chartWidth - 72), top: Math.max(selected.y - 42, 2) }]}>
          {series.map((item) => <Text key={item.label} style={styles.tooltipText}>{item.label} {formatMoney(item.buckets.at(-1).amountCents)}</Text>)}
        </View>
        <View style={[styles.endpoint, { left: selected.x - 6, top: selected.y - 6 }]} />
        <View style={styles.xLabels}>
          {buckets.map((bucket, index) => <Text key={bucket.key} style={[styles.xLabel, index === buckets.length - 1 && styles.xLabelSelected]}>{bucket.label}</Text>)}
        </View>
      </View>
    </View>
  );
}

function SpendingCard({ transaction, income = false }) {
  const date = transaction.effectiveDate ?? transaction.date;
  const amountCents = transaction.amountCents ?? transaction.amount ?? 0;
  return (
    <View style={styles.spendingCard}>
      <View style={styles.categoryIcon}><Text style={styles.categoryIconText}>{categoryIcon(transaction)}</Text></View>
      <View style={styles.spendingCopy}>
        <Text numberOfLines={1} style={styles.merchant}>{transaction.description?.trim() || transaction.categoryId || transaction.category || 'Expense'}</Text>
        <Text numberOfLines={1} style={styles.secondary}>{dateLabel(date)}{transaction.sourceKey ? `  ·  ${transaction.sourceKey.replace(':', ' ')}` : ''}</Text>
      </View>
      <Text style={[styles.amount, income && styles.incomeAmount]}>{formatMoney(amountCents, income ? '+' : '-')}</Text>
    </View>
  );
}

export default function SummaryScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { view } = useLocalSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [accountSummary, setAccountSummary] = useState(null);
  const [localShowAll, setLocalShowAll] = useState(false);
  const [chartMode, setChartMode] = useState('spending');
  const [state, setState] = useState({ loading: true, error: null });

  const loadSummary = useCallback(() => {
    let active = true;
    setState({ loading: true, error: null });
    Promise.all([getTransactions(auth.currentUser?.uid), getAccountSummary()])
      .then(([nextTransactions, nextSummary]) => {
        if (!active) return;
        setTransactions(nextTransactions);
        setAccountSummary(nextSummary);
        setState({ loading: false, error: null });
      })
      .catch((error) => active && setState({ loading: false, error: error.message || 'Unable to load spending.' }));
    return () => { active = false; };
  }, []);

  useFocusEffect(loadSummary);

  const expenses = useMemo(() => transactions.filter(isActualExpense), [transactions]);
  const gains = useMemo(() => transactions.filter(isActualIncome), [transactions]);
  const chartEndDate = useMemo(() => transactions.map((transaction) => transaction.effectiveDate ?? transaction.date).filter(Boolean).sort().at(-1), [transactions]);
  const spendingChart = useMemo(() => aggregateSpendingByMonth(expenses, { months: 6, endDate: chartEndDate }), [expenses, chartEndDate]);
  const incomeChart = useMemo(() => aggregateIncomeByMonth(gains, { months: 6, endDate: chartEndDate }), [gains, chartEndDate]);
  const chartSeries = chartMode === 'income'
    ? [{ ...incomeChart, label: 'Gains', color: COLORS.positive }]
    : chartMode === 'compare'
      ? [{ ...spendingChart, label: 'Spent', color: '#2F5D7C' }, { ...incomeChart, label: 'Gains', color: COLORS.positive }]
      : [{ ...spendingChart, label: 'Spent', color: '#2F5D7C' }];
  const chart = chartSeries[0];
  const firstMonth = `${chart.buckets[0].key}-01`;
  const latestMonth = chart.buckets.at(-1).key;
  const stats = useMemo(() => spendingSummary(expenses, { startDate: firstMonth, endDate: `${latestMonth}-31` }), [expenses, firstMonth, latestMonth]);
  const gainsStats = useMemo(() => incomeSummary(gains, { startDate: firstMonth, endDate: `${latestMonth}-31` }), [gains, firstMonth, latestMonth]);
  const showAll = view === 'all' || localShowAll;
  const recent = showAll ? expenses : expenses.slice(0, 4);
  const recentGains = showAll ? gains : gains.slice(0, 4);
  const contentBottom = Math.max(insets.bottom + 78, 92);

  if (state.loading) return <View style={styles.centerState}><ActivityIndicator color={COLORS.blue} /><Text style={styles.stateText}>Loading your spending…</Text></View>;

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.topButton}><Text style={styles.backArrow}>‹</Text></Pressable>
            <Text style={styles.title}>My Spending</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="More spending options" style={styles.topButton}><Text style={styles.more}>•••</Text></Pressable>
          </View>

          {state.error ? <View style={styles.errorCard}><Text style={styles.errorTitle}>Couldn’t load spending</Text><Text style={styles.secondary}>{state.error}</Text></View> : null}

          <View style={styles.chartCard}>
            <View style={styles.sectionHeading}><View><Text style={styles.eyebrow}>{chartMode === 'compare' ? 'Spending vs gains' : chartMode === 'income' ? 'Gains overview' : 'Spending overview'}</Text><Text style={styles.chartTotal}>{formatMoney(chartMode === 'income' ? gainsStats.totalCents : stats.totalCents)}</Text></View><Text style={styles.periodLabel}>Last 6 months</Text></View>
            <View style={styles.chartSwitch}>
              {[['spending', 'Spending'], ['income', 'Income'], ['compare', 'Compare']].map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: chartMode === value }} onPress={() => setChartMode(value)} style={[styles.chartSwitchOption, chartMode === value && styles.chartSwitchOptionSelected]}><Text style={[styles.chartSwitchText, chartMode === value && styles.chartSwitchTextSelected]}>{label}</Text></Pressable>)}
            </View>
            <Chart series={chartSeries} width={width - 40} />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}><Text style={[styles.statValue, styles.incomeAmount]}>{formatMoney(gainsStats.totalCents)}</Text><Text style={styles.statLabel}>Gains</Text></View>
            <View style={styles.statCard}><Text style={styles.statValue}>{stats.transactionCount}</Text><Text style={styles.statLabel}>Expenses</Text></View>
            <View style={styles.statCard}><Text style={styles.statValue}>{formatMoney(accountSummary?.trackedTotalCents ?? 0)}</Text><Text style={styles.statLabel}>Tracked total</Text></View>
            <View style={styles.statCard}><Text style={styles.statValue}>{formatMoney(accountSummary?.unallocatedCents ?? 0)}</Text><Text style={styles.statLabel}>Unallocated</Text></View>
          </View>

          <View style={styles.listHeader}><Text style={styles.listTitle}>Recent spending</Text><Pressable accessibilityRole="button" accessibilityLabel={showAll ? 'Show recent spending' : 'See all spending'} onPress={() => { if (showAll) setLocalShowAll(false); else { setLocalShowAll(true); router.push('/transactions?view=all'); } }}><Text style={styles.seeAll}>{showAll ? 'Show less' : 'See all'}</Text></Pressable></View>
          {recent.length ? recent.map((transaction) => <SpendingCard key={transaction.id ?? `${transaction.effectiveDate}-${transaction.amountCents}`} transaction={transaction} />) : <View style={styles.emptyCard}><Text style={styles.emptyIcon}>↘</Text><Text style={styles.emptyTitle}>No spending yet</Text><Text style={styles.secondary}>Your actual expenses will appear here once you record them.</Text></View>}
          {recentGains.length ? <>
            <View style={styles.listHeader}><Text style={styles.listTitle}>Recent gains</Text></View>
            {recentGains.map((transaction) => <SpendingCard key={`gain-${transaction.id ?? `${transaction.effectiveDate}-${transaction.amountCents}`}`} transaction={transaction} income />)}
          </> : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14 },
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: COLORS.navy, fontSize: 38, lineHeight: 34, fontWeight: '300' },
  more: { color: COLORS.navy, fontSize: 18, letterSpacing: 2, marginTop: -8 },
  title: { color: COLORS.navy, fontSize: 20, fontWeight: '700' },
  chartCard: { backgroundColor: COLORS.card, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.navy, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { color: COLORS.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  chartTotal: { color: COLORS.navy, fontSize: 26, fontWeight: '800', marginTop: 3 },
  periodLabel: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  chartSwitch: { flexDirection: 'row', alignSelf: 'flex-start', marginTop: 12, padding: 3, borderRadius: 16, backgroundColor: '#F2F3EF' },
  chartSwitchOption: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 13 },
  chartSwitchOptionSelected: { backgroundColor: COLORS.navy },
  chartSwitchText: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  chartSwitchTextSelected: { color: COLORS.card },
  chartShell: { flexDirection: 'row', marginTop: 12 },
  axisLabels: { width: 48, height: 164, justifyContent: 'space-between', paddingBottom: 19 },
  axisLabel: { color: COLORS.muted, fontSize: 9, textAlign: 'left' },
  chart: { position: 'relative', overflow: 'hidden' },
  gridLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#E5E6E4' },
  selectedBand: { position: 'absolute', backgroundColor: 'rgba(255, 197, 49, 0.18)', borderRadius: 12 },
  lineSegment: { position: 'absolute', height: 3, backgroundColor: '#2F5D7C', borderRadius: 3, transformOrigin: 'left center' },
  endpoint: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.card, borderWidth: 3, borderColor: COLORS.blue },
  tooltip: { position: 'absolute', minWidth: 68, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: COLORS.navy, alignItems: 'center' },
  tooltipText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  xLabels: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between' },
  xLabel: { color: COLORS.muted, fontSize: 10 },
  xLabelSelected: { color: COLORS.navy, fontWeight: '700' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.border },
  statValue: { color: COLORS.navy, fontSize: 14, fontWeight: '800' },
  statLabel: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
  incomeAmount: { color: COLORS.positive },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 },
  listTitle: { color: COLORS.navy, fontSize: 18, fontWeight: '800' },
  seeAll: { color: COLORS.blue, fontSize: 12, fontWeight: '700' },
  spendingCard: { minHeight: 70, backgroundColor: COLORS.card, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, padding: 12, flexDirection: 'row', alignItems: 'center' },
  categoryIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F4F1DF', alignItems: 'center', justifyContent: 'center' },
  categoryIconText: { color: COLORS.navy, fontSize: 18 },
  spendingCopy: { flex: 1, minWidth: 0, marginHorizontal: 11 },
  merchant: { color: COLORS.navy, fontSize: 13, fontWeight: '700' },
  secondary: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  amount: { color: COLORS.navy, fontSize: 13, fontWeight: '800' },
  emptyCard: { padding: 24, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, alignItems: 'center' },
  emptyIcon: { color: COLORS.muted, fontSize: 28 },
  emptyTitle: { color: COLORS.navy, fontSize: 15, fontWeight: '700', marginTop: 8 },
  errorCard: { padding: 14, borderRadius: 16, backgroundColor: '#FFF1EE', borderWidth: 1, borderColor: '#F2C6BC' },
  errorTitle: { color: '#8C3E32', fontSize: 13, fontWeight: '700' },
  centerState: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { color: COLORS.muted, fontSize: 13 },
});

