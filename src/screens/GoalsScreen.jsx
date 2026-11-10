import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth } from '../../config/firebase';
import { savingsProgress } from '../domain/SavingsCalculations';
import {
  createSavingsGoal,
  getUserGoals,
} from '../services/SavingsGoalService';

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function createRequestId(prefix) {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomPart}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 110);
}

function dollarsToCents(value) {
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Enter a positive dollar amount with no more than two decimal places.');
  }
  const [dollars, cents = ''] = normalized.split('.');
  const amountCents = Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error('Target amount must be greater than zero.');
  }
  return amountCents;
}

function formatMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatGoal(goal) {
  try {
    return savingsProgress({
      targetCents: goal.targetCents,
      savedCents: goal.savedCents ?? 0,
      startDate: goal.startDate,
      deadlineDate: goal.deadlineDate,
      asOfDate: todayString(),
    });
  } catch {
    return null;
  }
}

export default function GoalsScreen() {
  const [user, setUser] = useState(undefined);
  const [goals, setGoals] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isCreateMenuVisible, setCreateMenuVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startDate, setStartDate] = useState(todayString());
  const [deadlineDate, setDeadlineDate] = useState('');
  const [pendingGoalId, setPendingGoalId] = useState('');
  const [formError, setFormError] = useState('');

  const loadGoals = async () => {
    if (!auth.currentUser) {
      setGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setGoals(await getUserGoals());
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Unable to load your savings goals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser);
    loadGoals();
  }), []);

  const closeCreateMenu = () => {
    setCreateMenuVisible(false);
    setFormError('');
    setPendingGoalId('');
  };

  const openCreateMenu = () => {
    setFormError('');
    setPendingGoalId((current) => current || createRequestId('goal'));
    setCreateMenuVisible(true);
  };

  const saveGoal = async () => {
    if (!name.trim() || !startDate || !deadlineDate) {
      setFormError('Name, start date, and deadline are required.');
      return;
    }
    if (deadlineDate < startDate) {
      setFormError('Deadline must be on or after the start date.');
      return;
    }
    let targetCents;
    try {
      targetCents = dollarsToCents(targetAmount);
    } catch (validationError) {
      setFormError(validationError.message);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const goalId = pendingGoalId || createRequestId('goal');
      setPendingGoalId(goalId);
      await createSavingsGoal({
        requestId: createRequestId('goal-create'),
        goalId,
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        targetCents,
        startDate,
        deadlineDate,
      });
      setName('');
      setDescription('');
      setTargetAmount('');
      setStartDate(todayString());
      setDeadlineDate('');
      closeCreateMenu();
      await loadGoals();
    } catch (saveError) {
      setFormError(saveError.message || 'Unable to save this goal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle" style={styles.title}>Savings Goals</ThemedText>
          {!user && user !== undefined ? (
            <ThemedText style={styles.notice}>Sign in to create and view savings goals.</ThemedText>
          ) : null}
          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <ThemedView style={styles.goalsPanel}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a savings goal"
              disabled={!user || isSaving}
              onPress={openCreateMenu}
              style={[styles.createButton, (!user || isSaving) && styles.disabledButton]}
            >
              <ThemedText style={styles.createButtonText}>Create Savings Goal</ThemedText>
              <ThemedText style={styles.plus}>+</ThemedText>
            </Pressable>

            {isLoading ? <ActivityIndicator color="#37474F" /> : null}
            {!isLoading && user && goals.length === 0 ? (
              <ThemedText style={styles.emptyText}>No savings goals yet.</ThemedText>
            ) : null}
            <View style={styles.goalList}>
              {goals.map((goal) => {
                const progress = formatGoal(goal);
                return (
                  <View key={goal.id} style={styles.goalCard}>
                    <ThemedText style={styles.goalName}>{goal.name}</ThemedText>
                    {goal.description ? <ThemedText style={styles.description}>{goal.description}</ThemedText> : null}
                    <ThemedText style={styles.goalValue}>
                      {formatMoney(goal.savedCents ?? 0)} of {formatMoney(goal.targetCents)} saved
                    </ThemedText>
                    <ThemedText style={styles.goalMeta}>Deadline: {goal.deadlineDate}</ThemedText>
                    {progress ? (
                      <ThemedText style={styles.goalMeta}>
                        {progress.completed ? 'Achieved' : `${formatMoney(progress.remainingCents)} remaining`}
                        {!progress.completed && progress.dailyRequiredCents !== null
                          ? ` · ${formatMoney(progress.dailyRequiredCents)}/day`
                          : ''}
                        {progress.onTrack ? ' · On track' : ' · Behind pace'}
                      </ThemedText>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      <Modal animationType="slide" transparent visible={isCreateMenuVisible} onRequestClose={closeCreateMenu}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={styles.modalTitle}>Create Savings Goal</ThemedText>
              <Pressable accessibilityRole="button" onPress={closeCreateMenu} style={styles.closeButton}>
                <ThemedText style={styles.closeButtonText}>×</ThemedText>
              </Pressable>
            </View>
            <ThemedText style={styles.inputLabel}>Name</ThemedText>
            <TextInput value={name} onChangeText={setName} placeholder="Emergency fund" style={styles.input} />
            <ThemedText style={styles.inputLabel}>Description (optional)</ThemedText>
            <TextInput value={description} onChangeText={setDescription} placeholder="What are you saving for?" style={styles.input} />
            <ThemedText style={styles.inputLabel}>Target amount (USD)</ThemedText>
            <TextInput value={targetAmount} onChangeText={setTargetAmount} placeholder="900.00" keyboardType="decimal-pad" style={styles.input} />
            <ThemedText style={styles.inputLabel}>Start date (YYYY-MM-DD)</ThemedText>
            <TextInput value={startDate} onChangeText={setStartDate} placeholder="2026-11-09" style={styles.input} />
            <ThemedText style={styles.inputLabel}>Deadline (YYYY-MM-DD)</ThemedText>
            <TextInput value={deadlineDate} onChangeText={setDeadlineDate} placeholder="2026-12-31" style={styles.input} />
            {formError ? <ThemedText style={styles.formError}>{formError}</ThemedText> : null}
            <Pressable accessibilityRole="button" disabled={isSaving} onPress={saveGoal} style={styles.saveButton}>
              {isSaving ? <ActivityIndicator color="#111827" /> : <ThemedText style={styles.saveButtonText}>Save Goal</ThemedText>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, safeArea: { flex: 1 }, content: { flexGrow: 1, padding: 20, paddingBottom: 110 },
  title: { marginBottom: 18, fontSize: 24 }, notice: { marginBottom: 16, color: '#6B7280' }, error: { marginBottom: 12, color: '#B91C1C' },
  goalsPanel: { padding: 20, borderRadius: 24, backgroundColor: '#FFFFFF' }, createButton: { minHeight: 48, marginBottom: 18, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFC400' }, disabledButton: { opacity: 0.5 }, createButtonText: { color: '#111827', fontWeight: '700' }, plus: { position: 'absolute', right: 28, color: '#111827', fontSize: 28 },
  emptyText: { paddingVertical: 18, color: '#6B7280', textAlign: 'center' }, goalList: { gap: 12 }, goalCard: { padding: 16, borderRadius: 18, backgroundColor: '#37474F' }, goalName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' }, description: { marginTop: 5, color: '#E5E7EB' }, goalValue: { marginTop: 14, color: '#FFFFFF', fontSize: 16 }, goalMeta: { marginTop: 6, color: '#D1D5DB' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17, 24, 39, 0.45)' }, modalCard: { padding: 24, paddingBottom: 32, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFFFFF' }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, modalTitle: { fontSize: 22 }, closeButton: { padding: 4 }, closeButtonText: { color: '#4B5563', fontSize: 30 }, inputLabel: { marginBottom: 6, color: '#374151', fontWeight: '700' }, input: { minHeight: 44, marginBottom: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, color: '#111827', backgroundColor: '#F9FAFB' }, formError: { marginBottom: 12, color: '#B91C1C' }, saveButton: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFC400' }, saveButtonText: { color: '#111827', fontWeight: '700' },
});
