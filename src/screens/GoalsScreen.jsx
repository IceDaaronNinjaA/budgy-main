import { useEffect, useRef, useState } from 'react';
import {
  Image,
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

const repeatOptions = ['Does Not Repeat', 'Daily', 'Weekly', 'Monthly', 'Yearly'];

export default function GoalsScreen() {
  const [goals, setGoals] = useState([]);
  const [isCreateMenuVisible, setCreateMenuVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repeat, setRepeat] = useState('');
  const [isRepeatMenuVisible, setRepeatMenuVisible] = useState(false);
  const [formError, setFormError] = useState('');
  const [achievementMessageVisible, setAchievementMessageVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const achievementMessageTimeout = useRef(null);

  const openCreateMenu = () => {
    setFormError('');
    setCreateMenuVisible(true);
  };

  const closeCreateMenu = () => {
    setCreateMenuVisible(false);
    setRepeatMenuVisible(false);
    setFormError('');
  };

  const saveGoal = () => {
    if (!name.trim() || !description.trim() || !repeat) {
      setFormError('Please complete every field before saving your goal.');
      return;
    }

    setGoals((currentGoals) => [
      ...currentGoals,
      {
        name: name.trim(),
        description: description.trim(),
        repeat,
      },
    ]);
    setName('');
    setDescription('');
    setRepeat('');
    closeCreateMenu();
  };

  const getNextAchievementTime = (repeat, date = new Date()) => {
    const nextDate = new Date(date);

    if (repeat === 'Daily') {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (repeat === 'Weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (repeat === 'Monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (repeat === 'Yearly') {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }

    return nextDate.getTime();
  };

  const showAchievementMessage = () => {
    setAchievementMessageVisible(true);
    if (achievementMessageTimeout.current) {
      clearTimeout(achievementMessageTimeout.current);
    }
    achievementMessageTimeout.current = setTimeout(() => {
      setAchievementMessageVisible(false);
    }, 3000);
  };

  const achieveGoal = (goalIndex) => {
    const goal = goals[goalIndex];
    if (!goal || (goal.achievedUntil && goal.achievedUntil > currentTime)) {
      return;
    }

    if (goal.repeat === 'Does Not Repeat') {
      setGoals((currentGoals) => currentGoals.filter((_, index) => index !== goalIndex));
    } else {
      setGoals((currentGoals) => currentGoals.map((currentGoal, index) => (
        index === goalIndex
          ? { ...currentGoal, achievedUntil: getNextAchievementTime(currentGoal.repeat) }
          : currentGoal
      )));
    }

    showAchievementMessage();
  };

  useEffect(() => {
    const nextResetTime = goals
      .map((goal) => goal.achievedUntil)
      .filter((achievedUntil) => achievedUntil && achievedUntil > currentTime)
      .sort((first, second) => first - second)[0];

    if (!nextResetTime) {
      return undefined;
    }

    const resetTimer = setTimeout(() => setCurrentTime(Date.now()), nextResetTime - currentTime);
    return () => clearTimeout(resetTimer);
  }, [goals, currentTime]);

  useEffect(() => () => {
    if (achievementMessageTimeout.current) {
      clearTimeout(achievementMessageTimeout.current);
    }
  }, []);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle" style={styles.title}>Goals</ThemedText>

          <Pressable accessibilityRole="button" style={styles.backButton}>
            <ThemedText style={styles.backArrow}>{'<-'}</ThemedText>
          </Pressable>

          <View style={styles.artworkContainer}>
            <Image
              source={require('../../monsters/slime.gif')}
              style={styles.artwork}
              resizeMode="contain"
            />
          </View>

          <ThemedView style={styles.goalsPanel}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a goal"
              onPress={openCreateMenu}
              style={styles.createButton}
            >
              <ThemedText style={styles.createButtonText}>Create Goal</ThemedText>
              <ThemedText style={styles.plus}>+</ThemedText>
            </Pressable>

            <View style={styles.goalList}>
              {goals.map((goal, index) => {
                const isAchieved = goal.achievedUntil && goal.achievedUntil > currentTime;

                return (
                <View key={`${goal.name}-${index}`} style={[styles.goalCard, isAchieved && styles.achievedGoalCard]}>
                  <View style={styles.goalCardHeader}>
                    <ThemedText style={styles.goalType}>{goal.repeat}</ThemedText>
                    <ThemedText style={styles.goalDescription}>{goal.description}</ThemedText>
                  </View>
                  <View style={styles.goalCardFooter}>
                    <ThemedText style={styles.goalName}>{goal.name}</ThemedText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={isAchieved ? 'Goal already achieved' : 'Mark goal as achieved'}
                      disabled={isAchieved}
                      onPress={() => achieveGoal(index)}
                      style={[styles.arrowCircle, isAchieved && styles.achievedCheckCircle]}
                    >
                      <ThemedText style={styles.cardArrow}>{'✓'}</ThemedText>
                    </Pressable>
                  </View>
                </View>
                );
              })}
            </View>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      {achievementMessageVisible && (
        <View accessibilityLiveRegion="polite" style={styles.achievementMessage}>
          <ThemedText style={styles.achievementMessageText}>Goal Achieved!</ThemedText>
        </View>
      )}

      <Modal
        animationType="slide"
        transparent
        visible={isCreateMenuVisible}
        onRequestClose={closeCreateMenu}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={styles.modalTitle}>Create Goal</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close create goal menu"
                onPress={closeCreateMenu}
                style={styles.closeButton}
              >
                <ThemedText style={styles.closeButtonText}>×</ThemedText>
              </Pressable>
            </View>

            <ThemedText style={styles.inputLabel}>Name of Goal</ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter a goal name"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              returnKeyType="next"
            />

            <ThemedText style={styles.inputLabel}>Goal Description</ThemedText>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what you want to accomplish"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={[styles.input, styles.descriptionInput]}
            />

            <ThemedText style={styles.inputLabel}>Repeat</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose repeat frequency"
              onPress={() => setRepeatMenuVisible((visible) => !visible)}
              style={styles.dropdownButton}
            >
              <ThemedText style={repeat ? styles.dropdownText : styles.dropdownPlaceholder}>
                {repeat || 'Does Not Repeat'}
              </ThemedText>
              <ThemedText style={styles.dropdownArrow}>{isRepeatMenuVisible ? '▲' : '▼'}</ThemedText>
            </Pressable>

            {isRepeatMenuVisible && (
              <View style={styles.dropdownMenu}>
                {repeatOptions.map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    onPress={() => {
                      setRepeat(option);
                      setRepeatMenuVisible(false);
                    }}
                    style={styles.dropdownOption}
                  >
                    <ThemedText>{option}</ThemedText>
                  </Pressable>
                ))}
              </View>
            )}

            {formError ? <ThemedText style={styles.formError}>{formError}</ThemedText> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save goal"
              onPress={saveGoal}
              style={styles.saveButton}
            >
              <ThemedText style={styles.saveButtonText}>Save Goal</ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 },
  title: { marginBottom: 8, fontSize: 22 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 16 },
  backArrow: { color: '#4B5563', fontSize: 28, lineHeight: 28 },
  artworkContainer: {
    alignSelf: 'center', width: '68%', aspectRatio: 1, marginTop: 12, marginBottom: 28,
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB',
  },
  artwork: { width: '100%', height: '100%' },
  goalsPanel: {
    marginHorizontal: -20, paddingHorizontal: 26, paddingTop: 18, paddingBottom: 24,
    borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#FFFFFF',
  },
  createButton: {
    minHeight: 42, marginBottom: 22, borderRadius: 24, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFC400',
  },
  createButtonText: { color: '#111827', fontSize: 15, fontWeight: '700' },
  plus: { position: 'absolute', right: 42, color: '#111827', fontSize: 30, lineHeight: 30 },
  goalList: { gap: 10 },
  goalCard: {
    minHeight: 112, padding: 16, borderRadius: 20, justifyContent: 'space-between',
    backgroundColor: '#37474F',
  },
  achievedGoalCard: { backgroundColor: '#9CA3AF' },
  goalCardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  goalType: { color: '#F8FAFC', fontSize: 13 },
  goalDescription: { color: '#F8FAFC', fontSize: 13 },
  goalCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalName: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  arrowCircle: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFC42C',
  },
  achievedCheckCircle: { backgroundColor: '#D1D5DB' },
  cardArrow: { color: '#111827', fontSize: 24, lineHeight: 28, fontWeight: '700' },
  achievementMessage: {
    position: 'absolute', left: 20, right: 20, bottom: 28, paddingVertical: 14,
    borderRadius: 14, alignItems: 'center', backgroundColor: '#111827',
  },
  achievementMessageText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  modalBackdrop: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  modalCard: {
    padding: 24, paddingBottom: 32, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalTitle: { fontSize: 24 },
  closeButton: { padding: 4 },
  closeButtonText: { color: '#4B5563', fontSize: 30, lineHeight: 30 },
  inputLabel: { marginBottom: 6, color: '#374151', fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 46, marginBottom: 16, paddingHorizontal: 14, borderWidth: 1,
    borderColor: '#D1D5DB', borderRadius: 12, color: '#111827', backgroundColor: '#F9FAFB',
  },
  descriptionInput: { minHeight: 96, paddingTop: 12 },
  dropdownButton: {
    minHeight: 46, marginBottom: 8, paddingHorizontal: 14, borderWidth: 1,
    borderColor: '#D1D5DB', borderRadius: 12, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', backgroundColor: '#F9FAFB',
  },
  dropdownText: { color: '#111827' },
  dropdownPlaceholder: { color: '#6B7280' },
  dropdownArrow: { color: '#4B5563', fontSize: 12 },
  dropdownMenu: {
    marginBottom: 16, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12,
    overflow: 'hidden', backgroundColor: '#FFFFFF',
  },
  dropdownOption: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  formError: { marginBottom: 12, color: '#B91C1C', fontSize: 13 },
  saveButton: {
    minHeight: 48, marginTop: 8, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFC400',
  },
  saveButtonText: { color: '#111827', fontSize: 16, fontWeight: '700' },
});
