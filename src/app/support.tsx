import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useAuth } from '../lib/auth';
import { SUPPORT_EMAIL } from '../lib/legal';
import { LegalLinks } from '../lib/moderation';
import { supabase } from '../lib/supabase';
import { space, type } from '../lib/theme';
import { Button, Field, Screen } from '../lib/ui';

/** Send a message to the OUTHERENOW team (emailed to the admin by the notify-report function). */
export default function Support() {
  const { profile } = useAuth();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase.from('support_messages').insert({ user_id: profile.id, body: body.trim() });
    setBusy(false);
    if (error) return Alert.alert('Couldn’t send', error.message);
    Alert.alert('Sent', 'Thanks — we’ll get back to you by email within 24 hours.');
    router.back();
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
          <Text style={type.body}>Questions, bugs, a safety concern, or a request about your data? Tell us here and we’ll reply to the email you sign in with.</Text>
          <Field label="Message" value={body} onChangeText={setBody} multiline maxLength={2000} placeholder="What’s going on?" style={{ minHeight: 140, textAlignVertical: 'top' }} />
          <Button title="Send" onPress={send} loading={busy} disabled={!body.trim()} />
          {SUPPORT_EMAIL ? <Text style={type.small}>You can also email {SUPPORT_EMAIL}.</Text> : null}
          <Text style={type.small}>If someone is in danger, call 911 or your local emergency number first.</Text>
          <LegalLinks docs={['support', 'guidelines', 'privacy']} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
