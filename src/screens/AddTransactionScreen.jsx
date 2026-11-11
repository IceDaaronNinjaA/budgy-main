import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth } from '../../config/firebase';
import { parseUsdToCents, formatUsdFromCents } from '../domain/MoneyCalculations';
import {
  addTransaction,
  createTransactionCategory,
  getTransactionFormData,
} from '../services/TransactionService';

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function requestId() {
  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    .replace(/[^A-Za-z0-9_-]/g, '-');
}

export default function AddTransactionScreen() {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(localDateString());
  const [categoryId, setCategoryId] = useState('');
  const [sourceKey, setSourceKey] = useState('unallocated');
  const [formData, setFormData] = useState({ accountInitialized: false, categories: [], sources: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const pendingRequestId = useRef(null);

  const loadFormData = useCallback(async () => {
    if (!auth.currentUser) {
      setFormData({ accountInitialized: false, categories: [], sources: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const nextData = await getTransactionFormData();
      setFormData(nextData);
      setError('');
      setSourceKey((current) => nextData.sources.some((source) => source.key === current)
        ? current
        : (nextData.sources[0]?.key ?? ''));
    } catch (loadError) {
      setError(loadError.message || 'Unable to load transaction details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  const categories = useMemo(
    () => formData.categories.filter((category) => category.type === type),
    [formData.categories, type]
  );
  const availableSources = useMemo(() => formData.sources.filter((source) => {
    if (source.kind !== 'budget') return true;
    return effectiveDate >= source.startDate && effectiveDate < source.endExclusiveDate;
  }), [formData.sources, effectiveDate]);

  useEffect(() => {
    const selectedCategoryExists = categories.some((category) => category.id === categoryId);
    if (categoryId && !selectedCategoryExists) {
      setCategoryId('');
    } else if (type === 'expense' && !categoryId && categories.length) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId, type]);

  useEffect(() => {
    if (!availableSources.some((source) => source.key === sourceKey)) {
      setSourceKey(availableSources[0]?.key ?? '');
    }
  }, [availableSources, sourceKey]);

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setEffectiveDate(localDateString());
    setCategoryId(categories[0]?.id ?? '');
    setSuccess('');
    pendingRequestId.current = null;
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!auth.currentUser) {
      setError('Please sign in before adding a transaction.');
      return;
    }
    if (!formData.accountInitialized) {
      setError('Set up your tracked account before recording transactions.');
      return;
    }
    if (!description.trim()) {
      setError('Enter a description for this transaction.');
      return;
    }
    if (description.trim().length > 200) {
      setError('Description must be 200 characters or fewer.');
      return;
    }
    if (!isValidDate(effectiveDate)) {
      setError('Enter a real date using YYYY-MM-DD.');
      return;
    }
    if (type === 'expense' && !categoryId) {
      setError('Choose an expense category.');
      return;
    }
    if (type === 'expense' && !sourceKey) {
      setError('Choose a funding source for this expense.');
      return;
    }

    let amountCents;
    try {
      amountCents = parseUsdToCents(amount);
      if (amountCents <= 0) throw new Error('Amount must be greater than zero.');
    } catch (amountError) {
      setError(amountError.message || 'Enter a valid amount, such as 12.50.');
      return;
    }

    const selectedSource = availableSources.find((source) => source.key === sourceKey);
    if (type === 'expense' && selectedSource?.kind === 'goal' && amountCents > selectedSource.balanceCents) {
      setError(`This goal has only ${formatUsdFromCents(selectedSource.balanceCents)} available.`);
      return;
    }

    const submissionFingerprint = JSON.stringify({
      type, amountCents, description: description.trim(), effectiveDate, categoryId: categoryId || null,
      sourceKey: type === 'expense' ? sourceKey : null,
      budgetPeriodId: type === 'expense' ? selectedSource?.budgetPeriodId ?? null : null,
    });
    const savedRequestId = pendingRequestId.current?.fingerprint === submissionFingerprint
      ? pendingRequestId.current.id
      : requestId();
    pendingRequestId.current = { fingerprint: submissionFingerprint, id: savedRequestId };

    setSaving(true);
    try {
      await addTransaction({
        requestId: savedRequestId,
        type,
        amountCents,
        description,
        effectiveDate,
        categoryId: categoryId || null,
        sourceKey: type === 'expense' ? sourceKey : undefined,
        budgetPeriodId: type === 'expense' ? selectedSource?.budgetPeriodId : undefined,
      });
      resetForm();
      setSuccess(`${type === 'income' ? 'Income' : 'Expense'} saved successfully.`);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save this transaction. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      setError('Enter a category name.');
      return;
    }
    setCreatingCategory(true);
    setError('');
    try {
      const created = await createTransactionCategory({ name: newCategoryName, type });
      await loadFormData();
      setCategoryId(created.categoryId);
      setNewCategoryName('');
      setShowNewCategory(false);
    } catch (categoryError) {
      setError(categoryError.message || 'Unable to create category.');
    } finally {
      setCreatingCategory(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
                <ThemedText style={styles.backText}>‹</ThemedText>
              </Pressable>
              <View style={styles.headerCopy}>
                <ThemedText type="subtitle" style={styles.title}>Add Transaction</ThemedText>
                <ThemedText style={styles.subtitle}>Record money coming in or going out.</ThemedText>
              </View>
            </View>

            <View style={styles.typeSwitch}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: type === 'expense' }}
                onPress={() => { setType('expense'); setSuccess(''); setError(''); }}
                style={[styles.typeButton, type === 'expense' && styles.expenseSelected]}
              >
                <ThemedText style={[styles.typeText, type === 'expense' && styles.selectedTypeText]}>Expense</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: type === 'income' }}
                onPress={() => { setType('income'); setSuccess(''); setError(''); }}
                style={[styles.typeButton, type === 'income' && styles.incomeSelected]}
              >
                <ThemedText style={[styles.typeText, type === 'income' && styles.selectedTypeText]}>Income</ThemedText>
              </Pressable>
            </View>

            <View style={styles.card}>
              <ThemedText style={styles.fieldLabel}>Amount</ThemedText>
              <View style={styles.amountWrap}>
                <ThemedText style={styles.currencySymbol}>$</ThemedText>
                <TextInput
                  value={amount}
                  onChangeText={(value) => { setAmount(value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')); setError(''); }}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  style={styles.amountInput}
                  accessibilityLabel="Transaction amount in dollars"
                />
              </View>

              <ThemedText style={styles.fieldLabel}>Description</ThemedText>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={type === 'income' ? 'e.g. Part-time paycheck' : 'e.g. Grocery shopping'}
                maxLength={200}
                style={styles.textInput}
              />

              <View style={styles.labelRow}>
                <ThemedText style={styles.fieldLabel}>Date</ThemedText>
                <ThemedText style={styles.helperText}>YYYY-MM-DD</ThemedText>
              </View>
              <TextInput
                value={effectiveDate}
                onChangeText={setEffectiveDate}
                placeholder="2026-11-10"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                style={styles.textInput}
              />

              <View style={styles.labelRow}>
                <ThemedText style={styles.fieldLabel}>Category {type === 'income' ? '(optional)' : ''}</ThemedText>
                <Pressable onPress={() => { setShowNewCategory((value) => !value); setError(''); }}>
                  <ThemedText style={styles.addCategoryText}>+ New category</ThemedText>
                </Pressable>
              </View>
              {categories.length || type === 'income' ? (
                <View style={styles.chipWrap}>
                  {type === 'income' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: !categoryId }}
                      onPress={() => setCategoryId('')}
                      style={[styles.chip, !categoryId && styles.chipSelected]}
                    >
                      <ThemedText style={[styles.chipText, !categoryId && styles.chipTextSelected]}>No category</ThemedText>
                    </Pressable>
                  ) : null}
                  {categories.map((category) => (
                    <Pressable
                      key={category.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: categoryId === category.id }}
                      onPress={() => setCategoryId(category.id)}
                      style={[styles.chip, categoryId === category.id && styles.chipSelected]}
                    >
                      <ThemedText style={[styles.chipText, categoryId === category.id && styles.chipTextSelected]}>{category.name}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <ThemedText style={styles.helperText}>No {type} categories yet. Create one to continue.</ThemedText>
              )}

              {showNewCategory ? (
                <View style={styles.newCategoryRow}>
                  <TextInput
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    placeholder={`New ${type} category`}
                    maxLength={80}
                    style={[styles.textInput, styles.newCategoryInput]}
                  />
                  <Pressable disabled={creatingCategory} onPress={handleCreateCategory} style={styles.smallAddButton}>
                    {creatingCategory ? <ActivityIndicator color="#17212B" /> : <ThemedText style={styles.smallAddText}>Add</ThemedText>}
                  </Pressable>
                </View>
              ) : null}

              {type === 'expense' ? (
                <>
                  <ThemedText style={[styles.fieldLabel, styles.sourceLabel]}>Pay from</ThemedText>
                  {availableSources.length ? (
                    <View style={styles.sourceList}>
                      {availableSources.map((source) => (
                        <Pressable
                          key={source.key}
                          accessibilityRole="button"
                          accessibilityState={{ selected: sourceKey === source.key }}
                          onPress={() => setSourceKey(source.key)}
                          style={[styles.sourceOption, sourceKey === source.key && styles.sourceSelected]}
                        >
                          <View style={styles.sourceCopy}>
                            <ThemedText style={styles.sourceName}>{source.label}</ThemedText>
                            <ThemedText style={styles.sourceBalance}>{formatUsdFromCents(source.balanceCents)}</ThemedText>
                          </View>
                          <View style={[styles.radioOuter, sourceKey === source.key && styles.radioOuterSelected]}>
                            {sourceKey === source.key ? <View style={styles.radioInner} /> : null}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <ThemedText style={styles.helperText}>No eligible funding sources are available for this date.</ThemedText>
                  )}
                  <ThemedText style={styles.helperText}>Bill payments are recorded from the Bills workflow to prevent duplicate payments.</ThemedText>
                </>
              ) : null}
            </View>

            {!formData.accountInitialized && !loading ? (
              <View style={styles.noticeCard}>
                <ThemedText style={styles.noticeTitle}>Account setup required</ThemedText>
                <ThemedText style={styles.noticeText}>Initialize your tracked account before recording income or expenses.</ThemedText>
              </View>
            ) : null}
            {loading ? <ActivityIndicator style={styles.loader} color="#D99B00" /> : null}
            {error ? <ThemedText accessibilityRole="alert" style={styles.errorText}>{error}</ThemedText> : null}
            {success ? <ThemedText accessibilityRole="alert" style={styles.successText}>{success}</ThemedText> : null}

            <Pressable
              accessibilityRole="button"
              disabled={saving || loading || !formData.accountInitialized || (type === 'expense' && !availableSources.length)}
              onPress={handleSave}
              style={({ pressed }) => [styles.saveButton, pressed && styles.savePressed, (saving || loading || !formData.accountInitialized) && styles.saveDisabled]}
            >
              {saving ? <ActivityIndicator color="#17212B" /> : <ThemedText style={styles.saveText}>Save Transaction</ThemedText>}
            </Pressable>
            <Pressable disabled={saving} onPress={() => router.back()} style={styles.cancelButton}>
              <ThemedText style={styles.cancelText}>Cancel</ThemedText>
            </Pressable>
            <ThemedText style={styles.disclaimer}>Transactions are manually recorded and may differ from your bank balance.</ThemedText>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 130, maxWidth: 680, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 22, gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8EBED' },
  backText: { color: '#24313B', fontSize: 34, lineHeight: 38, marginTop: -4 },
  headerCopy: { flex: 1 },
  title: { fontSize: 29, lineHeight: 35, marginBottom: 2 },
  subtitle: { color: '#71808A', fontSize: 13 },
  typeSwitch: { flexDirection: 'row', padding: 5, borderRadius: 16, backgroundColor: '#E8EBED', marginBottom: 18 },
  typeButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  expenseSelected: { backgroundColor: '#FCE8E6' },
  incomeSelected: { backgroundColor: '#DDF4E6' },
  typeText: { color: '#687780', fontWeight: '700' },
  selectedTypeText: { color: '#24313B' },
  card: { padding: 18, borderRadius: 22, backgroundColor: '#FFFFFF', gap: 9, shadowColor: '#17212B', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  fieldLabel: { color: '#34434D', fontSize: 14, fontWeight: '700', marginTop: 7 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E1E6E8', paddingBottom: 8, marginBottom: 8 },
  currencySymbol: { fontSize: 30, fontWeight: '700', color: '#24313B', marginRight: 7 },
  amountInput: { flex: 1, fontSize: 34, fontWeight: '700', color: '#24313B', paddingVertical: 4 },
  textInput: { minHeight: 48, borderWidth: 1, borderColor: '#DCE2E5', borderRadius: 12, paddingHorizontal: 13, color: '#24313B', backgroundColor: '#FAFBFB', fontSize: 15 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  helperText: { color: '#78858D', fontSize: 12, lineHeight: 18 },
  addCategoryText: { color: '#A87800', fontSize: 13, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#DCE2E5', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, backgroundColor: '#FAFBFB' },
  chipSelected: { borderColor: '#E0A900', backgroundColor: '#FFF4CC' },
  chipText: { color: '#596771', fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: '#493600' },
  newCategoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newCategoryInput: { flex: 1 },
  smallAddButton: { minWidth: 56, height: 46, borderRadius: 12, backgroundColor: '#FFC531', alignItems: 'center', justifyContent: 'center' },
  smallAddText: { color: '#17212B', fontWeight: '800' },
  sourceLabel: { marginTop: 12 },
  sourceList: { gap: 8 },
  sourceOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 13, borderWidth: 1, borderColor: '#E0E5E8', backgroundColor: '#FAFBFB' },
  sourceSelected: { borderColor: '#D9A000', backgroundColor: '#FFF8E3' },
  sourceCopy: { gap: 3 },
  sourceName: { color: '#34434D', fontWeight: '700', fontSize: 14 },
  sourceBalance: { color: '#78858D', fontSize: 12 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#AAB4BA', alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: '#B78300' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#B78300' },
  noticeCard: { marginTop: 14, padding: 15, borderRadius: 14, backgroundColor: '#FFF5D6' },
  noticeTitle: { color: '#6B4B00', fontWeight: '800', marginBottom: 4 },
  noticeText: { color: '#765F2D', fontSize: 13, lineHeight: 19 },
  loader: { marginTop: 16 },
  errorText: { color: '#B42318', fontSize: 13, lineHeight: 19, marginTop: 12 },
  successText: { color: '#18794E', fontSize: 13, lineHeight: 19, marginTop: 12 },
  saveButton: { minHeight: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFC531', marginTop: 18 },
  savePressed: { opacity: 0.82 },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: '#17212B', fontSize: 16, fontWeight: '800' },
  cancelButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  cancelText: { color: '#64727A', fontWeight: '600' },
  disclaimer: { color: '#89949A', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 8 },
});
