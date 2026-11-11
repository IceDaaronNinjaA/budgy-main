import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth } from '../../config/firebase';
import { archiveSavingsGoal, createSavingsGoal, getUserGoals, updateSavingsGoal } from '../services/SavingsGoalService';

const today = () => new Date().toISOString().slice(0, 10);
const requestId = () => `goal-${Date.now()}-${Math.random().toString(36).slice(2)}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 90);
const centsFromDollars = (value) => {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter a valid dollar amount with up to two decimals.');
  const [dollars, cents = ''] = value.trim().split('.');
  const centsValue = Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
  if (!Number.isSafeInteger(centsValue) || centsValue <= 0) throw new Error('Target amount must be greater than zero.');
  return centsValue;
};

export default function GoalsScreen() {
  const [user, setUser] = useState(undefined);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [deadlineDate, setDeadlineDate] = useState('');
  const [formError, setFormError] = useState('');
  const [editingGoal, setEditingGoal] = useState(null);
  const [removingGoalId, setRemovingGoalId] = useState('');

  const loadGoals = async () => {
    if (!auth.currentUser) { setGoals([]); setLoading(false); return; }
    setLoading(true);
    try { setGoals(await getUserGoals()); setError(''); }
    catch (loadError) { setError(loadError.message || 'Unable to load goals.'); }
    finally { setLoading(false); }
  };

  useEffect(() => onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); loadGoals(); }), []);

  const saveGoal = async () => {
    if (!name.trim() || !startDate || !deadlineDate) { setFormError('Name, start date, and deadline are required.'); return; }
    if (deadlineDate < startDate) { setFormError('Deadline must be on or after the start date.'); return; }
    let targetCents;
    try { targetCents = centsFromDollars(target); } catch (validationError) { setFormError(validationError.message); return; }
    setSaving(true); setFormError('');
    try {
      const data = { goalId: editingGoal?.id ?? requestId(), name, description, targetCents, startDate, deadlineDate };
      if (editingGoal) await updateSavingsGoal(data);
      else await createSavingsGoal(data);
      setVisible(false); setName(''); setDescription(''); setTarget(''); setStartDate(today()); setDeadlineDate(''); await loadGoals();
      setEditingGoal(null);
    } catch (saveError) { setFormError(saveError.message || 'Unable to save goal.'); }
    finally { setSaving(false); }
  };

  const removeGoal = (goal) => {
    Alert.alert('Remove savings goal?', 'The goal will be archived and its history preserved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingGoalId(goal.id);
          setError('');
          try { await archiveSavingsGoal(goal.id); await loadGoals(); }
          catch (archiveError) { setError(archiveError.message || 'Unable to remove goal.'); }
          finally { setRemovingGoalId(''); }
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle" style={styles.title}>Savings Goals</ThemedText>
        {!user && user !== undefined ? <ThemedText style={styles.notice}>Sign in to manage savings goals.</ThemedText> : null}
        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
        <ThemedView style={styles.panel}>
          <Pressable disabled={!user} onPress={() => { setFormError(''); setVisible(true); }} style={styles.createButton}><ThemedText style={styles.buttonText}>Create Savings Goal</ThemedText></Pressable>
          {loading ? <ActivityIndicator /> : null}
          {!loading && user && goals.length === 0 ? <ThemedText style={styles.empty}>No savings goals yet.</ThemedText> : null}
          {goals.map((goal) => <View key={goal.id} style={styles.card}><ThemedText style={styles.goalName}>{goal.name}</ThemedText>{goal.description ? <ThemedText style={styles.description}>{goal.description}</ThemedText> : null}<ThemedText style={styles.meta}>${((goal.savedCents ?? 0) / 100).toFixed(2)} of ${(goal.targetCents / 100).toFixed(2)} saved</ThemedText><ThemedText style={styles.meta}>Deadline: {goal.deadlineDate}</ThemedText><View style={styles.actions}><Pressable onPress={() => { setEditingGoal(goal); setName(goal.name); setDescription(goal.description ?? ''); setTarget((goal.targetCents / 100).toFixed(2)); setStartDate(goal.startDate); setDeadlineDate(goal.deadlineDate); setFormError(''); setVisible(true); }} style={styles.editButton}><ThemedText style={styles.editText}>Edit</ThemedText></Pressable><Pressable disabled={removingGoalId === goal.id} onPress={() => removeGoal(goal)} style={styles.removeButton}><ThemedText style={styles.removeText}>{removingGoalId === goal.id ? 'Removing…' : 'Remove'}</ThemedText></Pressable></View></View>)}
        </ThemedView>
      </ScrollView></SafeAreaView>
      <Modal animationType="slide" transparent visible={visible} onRequestClose={() => { setVisible(false); setEditingGoal(null); }}><View style={styles.backdrop}><View style={styles.modal}><ThemedText type="subtitle" style={styles.modalTitle}>{editingGoal ? 'Edit Savings Goal' : 'Create Savings Goal'}</ThemedText><TextInput value={name} onChangeText={setName} placeholder="Goal name" style={styles.input} /><TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" style={styles.input} /><TextInput value={target} onChangeText={setTarget} placeholder="Target amount, e.g. 900.00" keyboardType="decimal-pad" style={styles.input} /><TextInput value={startDate} onChangeText={setStartDate} placeholder="Start date YYYY-MM-DD" style={styles.input} /><TextInput value={deadlineDate} onChangeText={setDeadlineDate} placeholder="Deadline YYYY-MM-DD" style={styles.input} />{formError ? <ThemedText style={styles.error}>{formError}</ThemedText> : null}<Pressable disabled={saving} onPress={saveGoal} style={styles.createButton}>{saving ? <ActivityIndicator /> : <ThemedText style={styles.buttonText}>{editingGoal ? 'Save Changes' : 'Save Goal'}</ThemedText>}</Pressable><Pressable onPress={() => { setVisible(false); setEditingGoal(null); }}><ThemedText style={styles.cancel}>Cancel</ThemedText></Pressable></View></View></Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, safeArea: { flex: 1 }, content: { padding: 20, paddingBottom: 110 }, title: { marginBottom: 18 }, notice: { color: '#6B7280' }, error: { marginVertical: 8, color: '#B91C1C' }, panel: { padding: 20, borderRadius: 22, backgroundColor: '#FFF' }, createButton: { minHeight: 46, marginBottom: 16, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFC400' }, buttonText: { color: '#111827', fontWeight: '700' }, empty: { padding: 18, color: '#6B7280', textAlign: 'center' }, card: { marginTop: 12, padding: 16, borderRadius: 16, backgroundColor: '#37474F' }, goalName: { color: '#FFF', fontSize: 20, fontWeight: '700' }, description: { marginTop: 5, color: '#E5E7EB' }, meta: { marginTop: 8, color: '#D1D5DB' }, actions: { flexDirection: 'row', gap: 8 }, editButton: { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: '#FFC400' }, editText: { color: '#111827', fontWeight: '700' }, removeButton: { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: '#FEE2E2' }, removeText: { color: '#B91C1C', fontWeight: '700' }, backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.4)' }, modal: { padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFF' }, modalTitle: { marginBottom: 16 }, input: { minHeight: 46, marginBottom: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10 }, cancel: { padding: 16, color: '#37474F', textAlign: 'center' },
});
