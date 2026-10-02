import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { PinLogo } from '../lib/logo';
import { supabase } from '../lib/supabase';
import { space, type } from '../lib/theme';
import { Button, Field, Screen } from '../lib/ui';

/** First-time setup after signing in: pick a name, then you're in. */
export default function Welcome() {
  const { refreshProfile, signOut } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const { error } = await supabase.rpc('create_my_profile', { p_display_name: name });
    setBusy(false);
    if (error) Alert.alert('Couldn’t create your profile', error.message);
    else await refreshProfile();
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center' }}>
            <PinLogo size={72} />
          </View>
          <Text style={[type.title, { textAlign: 'center' }]}>Welcome to OUTHERENOW</Text>
          <Text style={[type.body, { textAlign: 'center' }]}>Find spots, start camps and see who’s out right now. You can add a photo and what you do on your profile later.</Text>
          <Field
            label="What should people call you?"
            value={name}
            onChangeText={setName}
            placeholder="Your name or handle"
            maxLength={40}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => name.trim() && create()}
          />
          <Button title="Let’s go" onPress={create} loading={busy} disabled={!name.trim()} />
          <Button title="Sign out" variant="ghost" onPress={signOut} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
