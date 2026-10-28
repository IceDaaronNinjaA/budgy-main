import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const goals = [
  { name: 'Goal 1', description: 'Perfect your starters' },
  { name: 'Goal 2', description: 'Perfect your starters' },
];

export default function GoalsScreen() {
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
            <Pressable accessibilityRole="button" style={styles.createButton}>
              <ThemedText style={styles.createButtonText}>Create Goal</ThemedText>
              <ThemedText style={styles.plus}>+</ThemedText>
            </Pressable>

            <View style={styles.goalList}>
              {goals.map((goal) => (
                <Pressable key={goal.name} accessibilityRole="button" style={styles.goalCard}>
                  <View style={styles.goalCardHeader}>
                    <ThemedText style={styles.goalType}>Basic plan</ThemedText>
                    <ThemedText style={styles.goalDescription}>{goal.description}</ThemedText>
                  </View>
                  <View style={styles.goalCardFooter}>
                    <ThemedText style={styles.goalName}>{goal.name}</ThemedText>
                    <View style={styles.arrowCircle}>
                      <ThemedText style={styles.cardArrow}>{'>'}</ThemedText>
                    </View>
                  </View>
                </Pressable>
              ))}
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
  goalCardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  goalType: { color: '#F8FAFC', fontSize: 13 },
  goalDescription: { color: '#F8FAFC', fontSize: 13 },
  goalCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalName: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  arrowCircle: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFC42C',
  },
  cardArrow: { color: '#111827', fontSize: 30, lineHeight: 30, marginTop: -3 },
});
