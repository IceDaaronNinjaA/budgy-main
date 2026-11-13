import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getDashboardMetrics } from '@/services/DashboardService';
import styles from '@/styles/DashboardPageStyle';

const EMPTY_METRICS = {
  availableBalanceCents: 0,
  budgetSpentCents: 0,
  budgetLimitCents: 0,
  incomeCents: 0,
  expensesCents: 0,
};

function formatUsd(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export default function HomeScreen() {
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [error, setError] = useState('');

  const today = new Date();
  const currentMonth = {
    month: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(today),
    year: today.getFullYear(),
  };

  useEffect(() => {
    let active = true;

    getDashboardMetrics()
      .then((data) => {
        if (active) setMetrics(data);
      })
      .catch((dashboardError) => {
        console.error('Dashboard metrics failed to load:', dashboardError);
        if (active) {
          setMetrics(EMPTY_METRICS);
          const reason = dashboardError?.code || dashboardError?.message;
          setError(reason
            ? `We could not load your financial summary (${reason}).`
            : 'We could not load your financial summary.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const budgetLimit = metrics?.budgetLimitCents ?? 0;
  const budgetSpent = metrics?.budgetSpentCents ?? 0;
  const budgetProgress = budgetLimit > 0 ? Math.min(100, (budgetSpent / budgetLimit) * 100) : 0;
  const budgetRemaining = budgetLimit > 0 ? Math.max(0, 100 - budgetProgress) : 0;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerBlock}>
            <ThemedText type="subtitle" style={styles.mutedText}>
              {currentMonth.month} {currentMonth.year}
            </ThemedText>
            <ThemedText type="subtitle" style={styles.title}>Dashboard</ThemedText>
          </View>

          <ThemedView style={styles.balanceCard}>
            <View style={styles.cardHeader}>
              <View>
                <ThemedText type="small" style={styles.cardLabel}>Available balance</ThemedText>
                <ThemedText style={styles.balance}>{formatUsd(metrics.availableBalanceCents)}</ThemedText>
                {/* <ThemedText style={styles.positive}>+$320.15 this month</ThemedText> */}
              </View>
              <View style={styles.artwork}>
                <View style={styles.monsterCircle}>
                  <Image
                    source={require('../../assets/monsters/Leaf.gif')}
                    style={styles.petArtwork}
                    contentFit="contain"
                  />
                </View>
              </View>
            </View>
            <View style={styles.cardFooter}>
              <ThemedText type="small" style={styles.cardLabel}>Monthly spending</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See monthly spending details"
                style={({ pressed }) => [styles.cardButton, pressed && styles.cardButtonPressed]}
              >
                <ThemedText type="smallBold" style={styles.cardButtonText}>
                  See details
                </ThemedText>
                <Image
                  source={require('@/assets/icons/buttonArrow.svg')}
                  style={styles.cardButtonIcon}
                  contentFit="contain"
                />
              </Pressable>
            </View>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.statCard}>
            <View style={styles.statHeader}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>Budget for {currentMonth.month}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{Math.round(budgetRemaining)}% left</ThemedText>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${budgetProgress}%` }]} />
            </View>
            <View style={styles.statHeader}>
              <ThemedText style={styles.statValue}>{formatUsd(budgetSpent)}</ThemedText>
              <ThemedText type="small" style={styles.income}>of {formatUsd(budgetLimit)}</ThemedText>
            </View>
          </ThemedView>
         
          <View style={styles.statsRow}>
            <ThemedView type="backgroundElement" style={styles.statCardIncome}>
              <Image
                source={require('@/assets/icons/incomeArrow.svg')}
                style={styles.statCardIcon}
                contentFit="contain"
              />
              <ThemedText style={styles.statValue}>{formatUsd(metrics?.incomeCents ?? 0)}</ThemedText>
              <ThemedText type="small" style={styles.incomeTextCard}>Income</ThemedText>
            </ThemedView>
            <ThemedView type="backgroundElement" style={styles.statCardExpense}>
              <Image
                source={require('@/assets/icons/expenseArrow.svg')}
                style={styles.statCardIcon}
                contentFit="contain"
              />
              <ThemedText style={styles.statValue}>{formatUsd(metrics?.expensesCents ?? 0)}</ThemedText>
              <ThemedText type="small" style={styles.expenseTextCard}>Expenses</ThemedText>
            </ThemedView>
          </View>

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <ThemedView type="backgroundElement" style={styles.savingGoalCard}>
            <View style={styles.statCard}>
              <ThemedText type="small" style={styles.statLabel}>Create a saving Goal</ThemedText>
              <ThemedText style={styles.mutedText}>Set money aside for something that matters to you.</ThemedText>
            </View>
            <Image
              source={require('@/assets/icons/goalIcon.svg')}
              style={styles.statCardIcon}
              contentFit="contain"
            />
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

