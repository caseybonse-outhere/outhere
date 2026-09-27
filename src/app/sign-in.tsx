import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { PinLogo } from '../lib/logo';
import { supabase } from '../lib/supabase';
import { colors, space, type } from '../lib/theme';
import { Button, Field, Screen } from '../lib/ui';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase() });
    setBusy(false);
    if (error) Alert.alert('Could not send code', error.message);
    else setSent(true);
  }

  async function verify() {
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) Alert.alert('That code didn’t work', error.message);
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.brand}>
          <PinLogo size={88} />
          <Text style={styles.word}>out here</Text>
          <Text style={[type.small, { textAlign: 'center' }]}>Spots, jams and who’s out right now — flow, slackline, acro, parkour.</Text>
        </View>

        {!sent ? (
          <View style={styles.form}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <Button title="Email me a code" onPress={sendCode} loading={busy} disabled={!email.includes('@')} />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={type.body}>We sent a sign-in code to {email}.</Text>
            {/* Supabase projects can send 6–10 digit codes depending on the Email OTP Length setting. */}
            <Field label="Code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} keyboardType="number-pad" autoComplete="one-time-code" placeholder="12345678" maxLength={10} />
            <Button title="Sign in" onPress={verify} loading={busy} disabled={code.trim().length < 6} />
            <Button title="Use a different email" variant="ghost" onPress={() => setSent(false)} />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.xxl },
  brand: { alignItems: 'center', gap: space.sm },
  word: { fontSize: 44, fontWeight: '800', letterSpacing: -1.5, color: colors.night },
  form: { gap: space.lg },
});
