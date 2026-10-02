import { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { space, type } from '../lib/theme';
import { Button, Field, Screen } from '../lib/ui';

export default function Invite() {
  const { refreshProfile, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function redeem() {
    setBusy(true);
    const { error } = await supabase.rpc('redeem_invite', { p_code: code, p_display_name: name });
    setBusy(false);
    if (error) Alert.alert('Invite not accepted', error.message);
    else await refreshProfile();
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Text style={type.title}>OUTHERENOW is invite-only</Text>
        <Text style={type.body}>Enter the code a member shared with you. Once you’re in, you’ll get 3 codes of your own to pass on.</Text>
        <Field label="Invite code" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="ABCD1234" />
        <Field label="What should people call you?" value={name} onChangeText={setName} placeholder="Your name or handle" maxLength={40} />
        <Button title="Join" onPress={redeem} loading={busy} disabled={!code.trim() || !name.trim()} />
        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}
