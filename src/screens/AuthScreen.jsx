import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth } from '../../config/firebase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setRegistering] = useState(false);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      setError('Enter an email and a password with at least 6 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const action = isRegistering ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
      await action(auth, email.trim(), password);
    } catch (authError) {
      setError(authError.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <ThemedText type="title" style={styles.title}>Welcome to Budgy</ThemedText>
          <ThemedText style={styles.subtitle}>Sign in to keep your financial records private and persistent.</ThemedText>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            style={styles.input}
            value={email}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
          <Pressable disabled={isBusy} onPress={submit} style={styles.primaryButton}>
            {isBusy ? <ActivityIndicator color="#111827" /> : <ThemedText style={styles.primaryButtonText}>{isRegistering ? 'Create account' : 'Sign in'}</ThemedText>}
          </Pressable>
          <Pressable disabled={isBusy} onPress={() => { setRegistering((current) => !current); setError(''); }} style={styles.secondaryButton}>
            <ThemedText style={styles.secondaryButtonText}>{isRegistering ? 'Already have an account? Sign in' : 'Need an account? Register'}</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, safeArea: { flex: 1, justifyContent: 'center' }, card: { margin: 20, padding: 24, borderRadius: 24, backgroundColor: '#FFFFFF' },
  title: { marginBottom: 10 }, subtitle: { marginBottom: 22, color: '#4B5563' }, input: { minHeight: 48, marginBottom: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, color: '#111827', backgroundColor: '#F9FAFB' },
  error: { marginBottom: 12, color: '#B91C1C' }, primaryButton: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFC400' }, primaryButtonText: { color: '#111827', fontWeight: '700' }, secondaryButton: { paddingVertical: 16, alignItems: 'center' }, secondaryButtonText: { color: '#37474F', fontWeight: '600' },
});
