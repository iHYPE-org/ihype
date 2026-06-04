import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { setToken } from '@/lib/auth';

const BASE_URL: string = Constants.expoConfig?.extra?.apiBaseUrl ?? 'https://ihype.org';

type Step = 'email' | 'otp' | 'loading';

export default function SignInScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  async function requestOtp() {
    setError('');
    setStep('loading');
    try {
      await fetch(`${BASE_URL}/api/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setStep('otp');
    } catch {
      setError('Could not send code. Check your connection.');
      setStep('email');
    }
  }

  async function verifyOtp() {
    setError('');
    setStep('loading');
    try {
      const res = await fetch(`${BASE_URL}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp }),
      });
      if (!res.ok) throw new Error('Invalid code');
      const { token } = await res.json() as { token: string };
      await setToken(token);
      router.replace('/(tabs)/');
    } catch {
      setError('Invalid or expired code.');
      setStep('otp');
    }
  }

  if (step === 'loading') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#ff5029" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.logo}>iHYPE</Text>
        <Text style={styles.tagline}>your music command center</Text>

        {step === 'email' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={requestOtp}
            />
            <Pressable style={styles.btn} onPress={requestOtp}>
              <Text style={styles.btnText}>SEND CODE</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.hint}>Code sent to {email}</Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor="#666"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={verifyOtp}
            />
            <Pressable style={styles.btn} onPress={verifyOtp}>
              <Text style={styles.btnText}>SIGN IN</Text>
            </Pressable>
            <Pressable onPress={() => setStep('email')}>
              <Text style={styles.back}>← Different email</Text>
            </Pressable>
          </>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { alignItems: 'center', justifyContent: 'center' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: { color: '#ff5029', fontSize: 40, fontWeight: '900', letterSpacing: 4, marginBottom: 6 },
  tagline: { color: '#666', fontSize: 12, letterSpacing: 2, marginBottom: 48 },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  btn: {
    backgroundColor: '#ff5029', borderRadius: 8,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 2 },
  hint: { color: '#888', fontSize: 13, marginBottom: 16 },
  back: { color: '#666', fontSize: 13, textAlign: 'center', marginTop: 4 },
  error: { color: '#ff3e9a', fontSize: 13, textAlign: 'center', marginTop: 12 },
});
