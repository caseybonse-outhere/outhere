import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Share, Switch, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { syncHomeArea } from '../../lib/device';
import { supabase } from '../../lib/supabase';
import { colors, space, type } from '../../lib/theme';
import type { Invite, Profile } from '../../lib/types';
import { Button, Card, Screen, Segmented } from '../../lib/ui';

const RADII = [1, 5, 10, 25, 50];

export default function Me() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('invites')
        .select('*')
        .order('created_at')
        .then(({ data }) => setInvites((data ?? []) as Invite[]));
    }, []),
  );

  if (!profile) return null;

  async function update(fields: Partial<Profile>) {
    await supabase.from('profiles').update(fields).eq('id', profile!.id);
    await refreshProfile();
  }

  function confirmDelete() {
    Alert.alert('Delete your account?', 'This removes your profile, reviews and sessions. It can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('delete_my_account');
          if (error) Alert.alert('Couldn’t delete account', error.message);
          else await signOut();
        },
      },
    ]);
  }

  const open = invites.filter((i) => !i.used_by);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Text style={type.title}>{profile.display_name}</Text>

        <Card>
          <Text style={type.h2}>Nearby alerts</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={type.body}>Tell me about new jams and people out here</Text>
            <Switch
              value={profile.alerts_enabled}
              onValueChange={(v) => update({ alerts_enabled: v })}
              trackColor={{ true: colors.coralDark }}
              accessibilityLabel="Nearby alerts"
            />
          </View>
          <Text style={type.label}>Radius</Text>
          <Segmented
            options={RADII.map((r) => ({ label: `${r} mi`, value: r }))}
            value={profile.alert_radius_miles}
            onChange={(r) => update({ alert_radius_miles: r })}
          />
          <Text style={type.small}>
            Alerts use your rough area (to about 1 km), never your exact location.
            {profile.home_lat == null ? ' Your area isn’t set yet.' : ''}
          </Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              title="Update my area"
              variant="ghost"
              onPress={async () => {
                await syncHomeArea(profile.id);
                await refreshProfile();
              }}
            />
          </View>
        </Card>

        <Card>
          <Text style={type.h2}>Your invites</Text>
          <Text style={type.small}>Out Here grows by word of mouth. Share a code with someone you’d want to jam with.</Text>
          {invites.map((i) => (
            <View key={i.code} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
              <Text style={[type.body, { fontWeight: '800', letterSpacing: 1, opacity: i.used_by ? 0.4 : 1 }]}>{i.code}</Text>
              {i.used_by ? (
                <Text style={type.small}>Used</Text>
              ) : (
                <Button
                  title="Share"
                  variant="ghost"
                  onPress={() => Share.share({ message: `Come find us Out Here 📍 Your invite code: ${i.code}` })}
                />
              )}
            </View>
          ))}
          {open.length === 0 && invites.length > 0 && <Text style={type.small}>All your codes are used.</Text>}
        </Card>

        <Button title="Sign out" variant="secondary" onPress={signOut} />
        <Button title="Delete account" variant="danger" onPress={confirmDelete} />
      </ScrollView>
    </Screen>
  );
}
