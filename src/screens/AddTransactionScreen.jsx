import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { createUserCategory, ensureDefaultCategories } from '@/services/CategoryService';
import { addTransaction } from '@/services/TransactionService';
import { auth } from '../../config/firebase';

const COLORS = {
  background: '#2B3843',
  field: '#3E4B55',
  fieldMuted: '#52606A',
  text: '#FFFFFF',
  muted: '#B8C0C5',
  ink: '#1F2A33',
  yellow: '#FFC531',
};

function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function categorySupportsType(category, transactionType) {
  const categoryType = category.type ?? category.kind ?? 'both';
  return categoryType === transactionType || categoryType === 'both';
}

function formatAmount(digits) {
  return (Number(digits || 0) / 100).toFixed(2);
}

export default function AddTransactionScreen() {
  const [type, setType] = useState('expense');
  const [amountDigits, setAmountDigits] = useState('');
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [isCategoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [isLoadingCategories, setLoadingCategories] = useState(true);
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState(type);
  const [categoryModalError, setCategoryModalError] = useState('');
  const [isCreatingCategory, setCreatingCategory] = useState(false);
  const [isSuccessModalOpen, setSuccessModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setSaving] = useState(false);
  const availableCategories = categories.filter((item) => categorySupportsType(item, type));

  const openCategoryModal = () => {
    setCategoryMenuOpen(false);
    setNewCategoryName('');
    setNewCategoryType(type);
    setCategoryModalError('');
    setCategoryModalOpen(true);
  };

  const submitNewCategory = async () => {
    if (!newCategoryName.trim()) {
      setCategoryModalError('Enter a category name.');
      return;
    }

    setCreatingCategory(true);
    setCategoryModalError('');
    try {
      const createdCategory = await createUserCategory({ name: newCategoryName, type: newCategoryType });
      setCategories((current) => [...current, createdCategory].sort((first, second) => first.name.localeCompare(second.name)));
      if (newCategoryType === type) {
        setCategory(createdCategory.name);
        setCategoryId(createdCategory.id ?? createdCategory.categoryId ?? '');
      }
      setCategoryModalOpen(false);
    } catch (categoryError) {
      setCategoryModalError(categoryError.message || 'Could not create this category.');
    } finally {
      setCreatingCategory(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const userCategories = await ensureDefaultCategories(auth.currentUser?.uid);
        if (isMounted) {
          setCategories(userCategories);
          const initialCategory = userCategories.find((item) => categorySupportsType(item, 'expense'));
          setCategory(initialCategory?.name ?? '');
          setCategoryId(initialCategory?.id ?? initialCategory?.categoryId ?? '');
        }
      } catch (categoryError) {
        if (isMounted) setError(categoryError.message || 'Could not load categories.');
      } finally {
        if (isMounted) setLoadingCategories(false);
      }
    }

    loadCategories();
    return () => { isMounted = false; };
  }, []);

  const submit = async () => {
    const amountInCents = Number(amountDigits);
    if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
      setError('Enter an amount greater than $0.00.');
      return;
    }
    if (!name.trim()) {
      setError('Enter a name for this transaction.');
      return;
    }
    if (type === 'expense' && !categoryId) {
      setError('Choose a category before saving this expense.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await addTransaction({
        type,
        amount: amountInCents,
        categoryId,
        description: name.trim(),
        date: todayString(),
      });
      setAmountDigits('');
      setName('');
      setCategory('');
      setCategoryId('');
      setError('');
      setSuccessModalOpen(true);
    } catch (saveError) {
      setError(saveError.message || 'Could not save this transaction.');
    } finally {
      setSaving(false);
    }
  };

  const pressDigit = (digit) => {
    if (amountDigits.length >= 8) return;
    setAmountDigits((current) => `${current}${digit}`.replace(/^0+(?=\d)/, ''));
    setError('');
  };

  const removeDigit = () => setAmountDigits((current) => current.slice(0, -1));
  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
              <ThemedText style={styles.backArrow}>‹</ThemedText>
            </Pressable>
            <ThemedText style={styles.title}>New transaction</ThemedText>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.typeToggle}>
            {['income', 'expense'].map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: type === option }}
                onPress={() => {
                  setType(option);
                  const nextCategory = categories.find((item) => categorySupportsType(item, option));
                  setCategory(nextCategory?.name ?? '');
                  setCategoryId(nextCategory?.id ?? nextCategory?.categoryId ?? '');
                  setCategoryMenuOpen(false);
                }}
                style={[styles.typeOption, type === option && styles.typeOptionSelected]}
              >
                <ThemedText style={[styles.typeText, type === option && styles.typeTextSelected]}>
                  {option[0].toUpperCase() + option.slice(1)}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.amountSection}>
            <ThemedText style={styles.amount}>{`$${formatAmount(amountDigits)}`}</ThemedText>
            <View style={styles.categorySelector}>
              <Pressable
                accessibilityLabel="Change category"
                accessibilityState={{ expanded: isCategoryMenuOpen }}
                onPress={() => setCategoryMenuOpen((current) => !current)}
                style={styles.categoryPill}
              >
                <ThemedText style={styles.categoryText}>{isLoadingCategories ? 'Loading…' : category || 'Select category'}</ThemedText>
                <ThemedText style={styles.chevron}>{isCategoryMenuOpen ? '⌃' : '⌄'}</ThemedText>
              </Pressable>
              {isCategoryMenuOpen ? (
                <View style={styles.categoryMenu}>
                  <Pressable onPress={openCategoryModal} style={styles.categoryAddOption}>
                    <ThemedText style={styles.categoryAddOptionText}>+ New category</ThemedText>
                  </Pressable>
                  {availableCategories.length ? availableCategories.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="menuitem"
                      onPress={() => { setCategory(item.name); setCategoryId(item.id ?? item.categoryId ?? ''); setCategoryMenuOpen(false); }}
                      style={[styles.categoryOption, item.name === category && styles.categoryOptionSelected]}
                    >
                      <ThemedText style={[styles.categoryOptionText, item.name === category && styles.categoryOptionSelectedText]}>{item.name}</ThemedText>
                    </Pressable>
                  )) : <ThemedText style={styles.emptyCategoryText}>No categories found</ThemedText>}
                </View>
              ) : null}
            </View>
          </View>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
        </View>
      </SafeAreaView>
      <Modal
        animationType="fade"
        onRequestClose={() => setCategoryModalOpen(false)}
        transparent
        visible={isCategoryModalOpen}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.categoryModal}>
            <ThemedText style={styles.modalTitle}>New category</ThemedText>
            <ThemedText style={styles.modalSubtitle}>Choose which transaction type can use this category.</ThemedText>
            <TextInput
              accessibilityLabel="New category name"
              autoFocus
              maxLength={80}
              onChangeText={setNewCategoryName}
              onSubmitEditing={submitNewCategory}
              placeholder="Category name"
              placeholderTextColor="#7A858B"
              returnKeyType="done"
              style={styles.modalInput}
              value={newCategoryName}
            />
            <View style={styles.modalTypeToggle}>
              {['income', 'expense'].map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: newCategoryType === option }}
                  onPress={() => setNewCategoryType(option)}
                  style={[styles.modalTypeOption, newCategoryType === option && styles.modalTypeOptionSelected]}
                >
                  <ThemedText style={[styles.modalTypeText, newCategoryType === option && styles.modalTypeTextSelected]}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            {categoryModalError ? <ThemedText style={styles.modalError}>{categoryModalError}</ThemedText> : null}
            <View style={styles.modalActions}>
              <Pressable disabled={isCreatingCategory} onPress={() => setCategoryModalOpen(false)} style={styles.modalCancelButton}>
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable disabled={isCreatingCategory} onPress={submitNewCategory} style={styles.modalAddButton}>
                {isCreatingCategory ? <ActivityIndicator color={COLORS.ink} /> : <ThemedText style={styles.modalAddText}>Add category</ThemedText>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setSuccessModalOpen(false)}
        transparent
        visible={isSuccessModalOpen}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.successModal}>
            <View style={styles.successIcon}>
              <ThemedText style={styles.successCheck}>✓</ThemedText>
            </View>
            <ThemedText style={styles.modalTitle}>Transaction created successfully</ThemedText>
            <ThemedText style={styles.modalSubtitle}>Your {type} was saved to your transactions.</ThemedText>
            <Pressable onPress={() => setSuccessModalOpen(false)} style={styles.modalAddButton}>
              <ThemedText style={styles.modalAddText}>Done</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
      <View style={styles.keypad}>
        <TextInput
          accessibilityLabel="Transaction name"
          maxLength={60}
          onChangeText={setName}
          placeholder="Transaction name"
          placeholderTextColor="#6B757D"
          style={styles.nameInput}
          value={name}
        />
        <View style={styles.keyGrid}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'].map((key) => (
            <Pressable key={key} accessibilityLabel={key === 'back' ? 'Delete last digit' : `Enter ${key}`} onPress={() => key === 'back' ? removeDigit() : pressDigit(key)} style={styles.key}>
              <ThemedText style={styles.keyText}>{key === 'back' ? '⌫' : key}</ThemedText>
            </Pressable>
          ))}
        </View>
        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
        <Pressable disabled={isSaving} onPress={submit} style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}>
          {isSaving ? <ActivityIndicator color={COLORS.ink} /> : <ThemedText style={styles.saveText}>Add {type}</ThemedText>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  safeArea: { flex: 1, position: 'relative', zIndex: 10, elevation: 10 },
  content: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  backButton: { width: 42, height: 42, justifyContent: 'center' },
  backArrow: { color: COLORS.text, fontSize: 42, lineHeight: 42, fontWeight: '300' },
  headerSpacer: { width: 42 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '400' },
  typeToggle: { flexDirection: 'row', backgroundColor: COLORS.field, borderRadius: 28, padding: 4, marginBottom: 40 },
  typeOption: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 24 },
  typeOptionSelected: { backgroundColor: COLORS.yellow },
  typeText: { color: COLORS.muted, fontSize: 16, fontWeight: '600' },
  typeTextSelected: { color: COLORS.ink },
  amountSection: { alignItems: 'center', marginBottom: 10, zIndex: 20 },
  amount: { color: COLORS.text, fontSize: 54, lineHeight: 64, fontWeight: '300', marginBottom: 12 },
  nameInput: { width: '82%', minHeight: 38, alignSelf: 'center', marginBottom: 12, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: '#82909A', color: COLORS.ink, fontSize: 14, textAlign: 'center' },
  categorySelector: { position: 'relative', zIndex: 30, elevation: 12, alignItems: 'center' },
  categoryPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 19, minHeight: 40, borderRadius: 22, backgroundColor: COLORS.field },
  categoryText: { color: COLORS.text, fontSize: 15 },
  chevron: { width: 16, color: COLORS.text, fontSize: 20, lineHeight: 18, marginTop: -3, textAlign: 'center' },
  categoryMenu: { position: 'absolute', top: 48, minWidth: 160, padding: 6, borderRadius: 14, backgroundColor: '#1F2A33', borderWidth: 1, borderColor: '#71808A', shadowColor: '#000000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 12 },
  categoryOption: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9 },
  categoryOptionSelected: { backgroundColor: COLORS.yellow },
  categoryOptionText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  categoryOptionSelectedText: { color: COLORS.ink },
  emptyCategoryText: { color: '#AEB8BE', fontSize: 14, paddingHorizontal: 14, paddingVertical: 10 },
  categoryAddOption: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#52606A' },
  categoryAddOptionText: { color: COLORS.yellow, fontSize: 14, fontWeight: '700' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 30, 0.72)' },
  categoryModal: { width: '100%', maxWidth: 360, padding: 22, borderRadius: 22, backgroundColor: '#F6F6F3' },
  successModal: { width: '100%', maxWidth: 360, alignItems: 'center', padding: 24, borderRadius: 22, backgroundColor: '#F6F6F3' },
  successIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: '#D9F2DF', marginBottom: 14 },
  successCheck: { color: '#26753A', fontSize: 31, fontWeight: '700', lineHeight: 34 },
  modalTitle: { color: COLORS.ink, fontSize: 21, fontWeight: '700', marginBottom: 6 },
  modalSubtitle: { color: '#5E6970', fontSize: 14, lineHeight: 20, marginBottom: 18 },
  modalInput: { minHeight: 50, paddingHorizontal: 15, borderWidth: 1, borderColor: '#CBD2D5', borderRadius: 12, backgroundColor: '#FFFFFF', color: COLORS.ink, fontSize: 16, marginBottom: 12 },
  modalTypeToggle: { flexDirection: 'row', padding: 3, borderRadius: 22, backgroundColor: '#E2E6E7', marginBottom: 12 },
  modalTypeOption: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  modalTypeOptionSelected: { backgroundColor: COLORS.ink },
  modalTypeText: { color: '#5E6970', fontSize: 14, fontWeight: '700' },
  modalTypeTextSelected: { color: COLORS.text },
  modalError: { color: '#A73A3A', fontSize: 13, marginBottom: 10 },
  modalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  modalCancelButton: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: '#5E6970', fontWeight: '700' },
  modalAddButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.yellow },
  modalAddText: { color: COLORS.ink, fontWeight: '700' },
  keypad: { flex: 1.35, zIndex: 0, backgroundColor: '#F6F6F3', borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingHorizontal: 28, paddingTop: 24, paddingBottom: 76, justifyContent: 'flex-end' },
  keyGrid: { width: '100%', height: 328, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'space-between', marginBottom: 8 },
  key: { width: '33.333%', height: 76, alignItems: 'center', justifyContent: 'center' },
  keyText: { color: COLORS.ink, fontSize: 29, fontWeight: '300' },
  error: { color: '#A73A3A', textAlign: 'center', marginBottom: 8 },
  saveButton: { minHeight: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.yellow, borderRadius: 28 },
  saveButtonPressed: { opacity: 0.8 },
  saveText: { color: COLORS.ink, fontSize: 16, fontWeight: '700' },
});
