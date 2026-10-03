import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { PinLogo } from '../lib/logo';
import { LegalLinks } from '../lib/moderation';
import { supabase } from '../lib/supabase';
import { colors, space, type } from '../lib/theme';
import { Button, Field, Screen } from '../lib/ui';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  // Password sign-in exists for App Review's demo account (email codes can't reach reviewers).
  const [passwordMode, setPasswordMode] = useState(false);
  const [password, setPassword] = useState('');
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

  async function passwordSignIn() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) Alert.alert('Couldn’t sign in', error.message);
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.brand}>
          <PinLogo size={88} />
          <Text style={styles.word} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header">OUTHERENOW</Text>
          <Text style={[type.small, { textAlign: 'center' }]}>Spots, camps and who’s out right now — flow, slackline, acro, yoga, hiking and more.</Text>
        </View>

        {passwordMode ? (
          <View style={styles.form}>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" />
            <Button title="Sign in" onPress={passwordSignIn} loading={busy} disabled={!email.includes('@') || password.length < 6} />
            <Button title="Use an email code instead" variant="ghost" onPress={() => setPasswordMode(false)} />
          </View>
        ) : !sent ? (
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

        <View style={{ gap: space.xs }}>
          <Text style={[type.small, { textAlign: 'center' }]}>By continuing you agree to the Terms and Community Guidelines.</Text>
          <LegalLinks docs={['terms', 'guidelines', 'privacy', 'support']} />
          {!passwordMode && !sent && (
            <Pressable accessibilityRole="button" onPress={() => setPasswordMode(true)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'center' }}>
              <Text style={type.small}>Have a password? Sign in with password</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.xl },
  brand: { alignItems: 'center', gap: space.sm },
  word: { fontSize: 40, fontWeight: '800', letterSpacing: -1, color: colors.night, alignSelf: 'stretch', textAlign: 'center' },
  form: { gap: space.lg },
});
