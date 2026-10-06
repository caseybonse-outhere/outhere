import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { PinLogo } from '../lib/logo';
import { supabase } from '../lib/supabase';
import { colors, space, type } from '../lib/theme';
import { Button, Field, Screen } from '../lib/ui';

/**
 * First-time setup after signing in: pick a name and agree to the Terms.
 * Members who joined before the Terms existed only see the agreement.
 */
export default function Welcome() {
  const { profile, refreshProfile, signOut } = useAuth();
  const returning = !!profile; // has a profile, just hasn't agreed yet
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    const { error } = returning
      ? await supabase.rpc('accept_terms')
      : await supabase.rpc('create_my_profile', { p_display_name: name, p_accept_terms: agreed });
    setBusy(false);
    if (error) Alert.alert('Couldn’t continue', error.message);
    else await refreshProfile();
  }

  const ready = agreed && (returning || name.trim().length > 0);

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center' }}>
            <PinLogo size={72} />
          </View>
          <Text style={[type.title, { textAlign: 'center' }]}>{returning ? 'Quick check-in' : 'Welcome to Out Here Now'}</Text>
          <Text style={[type.body, { textAlign: 'center' }]}>
            {returning
              ? 'We’ve added Terms and Community Guidelines to keep Out Here Now a good place to be. Please read and agree to keep going.'
              : 'Find spots, start camps and see who’s out right now. You can add a photo and what you do on your profile later.'}
          </Text>

          {!returning && (
            <Field
              label="What should people call you?"
              value={name}
              onChangeText={setName}
              placeholder="Your name or handle"
              maxLength={40}
              autoFocus
              returnKeyType="done"
            />
          )}

          <View style={{ gap: space.sm }}>
            <Text style={type.small}>
              Out Here Now has zero tolerance for objectionable content or abusive behavior. Posts that break the rules are removed and the people who post them are banned. You must be 18 or older.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <DocLink label="Read the Terms" doc="terms" />
              <DocLink label="Community Guidelines" doc="guidelines" />
              <DocLink label="Privacy Policy" doc="privacy" />
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              onPress={() => setAgreed(!agreed)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 }}
            >
              <Ionicons name={agreed ? 'checkbox' : 'square-outline'} size={28} color={agreed ? colors.coralDark : colors.muted} />
              <Text style={[type.body, { flex: 1 }]}>I’m 18 or older and I agree to the Terms and Community Guidelines</Text>
            </Pressable>
          </View>

          <Button title={returning ? 'Agree and continue' : 'Let’s go'} onPress={go} loading={busy} disabled={!ready} />
          <Button title="Sign out" variant="ghost" onPress={signOut} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function DocLink({ label, doc }: { label: string; doc: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push(`/legal/${doc}`)} style={{ minHeight: 44, justifyContent: 'center', paddingRight: space.lg }}>
      <Text style={{ color: colors.coralDark, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}
