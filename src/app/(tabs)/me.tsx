import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Switch, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { Avatar, pickAndUploadAvatar } from '../../lib/avatar';
import { syncHomeArea } from '../../lib/device';
import { supabase } from '../../lib/supabase';
import { colors, space, type } from '../../lib/theme';
import { DISCIPLINES, INTERESTS, type Invite, type Profile } from '../../lib/types';
import { Button, Card, ChipGroup, Field, Screen, Segmented } from '../../lib/ui';

const RADII = [1, 5, 10, 25, 50];

export default function Me() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable copy of the profile.
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name);
    setBio(profile.bio ?? '');
    setDisciplines(profile.disciplines ?? []);
    setInterests(profile.interests ?? []);
  }, [profile?.id, profile?.display_name, profile?.bio, profile?.disciplines, profile?.interests]);

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

  const dirty =
    name.trim() !== profile.display_name ||
    bio.trim() !== (profile.bio ?? '') ||
    disciplines.join('|') !== (profile.disciplines ?? []).join('|') ||
    interests.join('|') !== (profile.interests ?? []).join('|');

  async function update(fields: Partial<Profile>) {
    const { error } = await supabase.from('profiles').update(fields).eq('id', profile!.id);
    if (error) Alert.alert('Couldn’t save', error.message);
    await refreshProfile();
  }

  async function saveProfile() {
    if (!name.trim()) return Alert.alert('Add a name', 'People need something to call you.');
    setSaving(true);
    await update({ display_name: name.trim(), bio: bio.trim() || null, disciplines, interests });
    setSaving(false);
  }

  async function changePhoto() {
    try {
      setUploading(true);
      const url = await pickAndUploadAvatar(profile!.id);
      if (url) await refreshProfile();
    } catch (e) {
      Alert.alert('Couldn’t update photo', e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
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
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
        {/* Profile */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={changePhoto} disabled={uploading}>
              <Avatar url={profile.avatar_url} name={profile.display_name} size={88} />
            </Pressable>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text style={type.title} numberOfLines={1}>
                {profile.display_name}
              </Text>
              <Pressable accessibilityRole="button" onPress={changePhoto} disabled={uploading} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: colors.coralDark, fontWeight: '700', fontSize: 16 }}>
                  {uploading ? 'Uploading…' : profile.avatar_url ? 'Change photo' : 'Add a photo'}
                </Text>
              </Pressable>
            </View>
          </View>

          <Field label="Name" value={name} onChangeText={setName} maxLength={40} />
          <Field label="About you" value={bio} onChangeText={setBio} multiline maxLength={280} placeholder="What you spin, where you train, what you’re working on…" />
          <Text style={type.label}>What I do</Text>
          <ChipGroup options={DISCIPLINES} value={disciplines} onChange={setDisciplines} />
          <Text style={type.label}>I’m into</Text>
          <ChipGroup options={INTERESTS} value={interests} onChange={setInterests} />
          <Button title={dirty ? 'Save profile' : 'Saved'} onPress={saveProfile} loading={saving} disabled={!dirty} />
        </Card>

        {/* Alerts */}
        <Card>
          <Text style={type.h2}>Nearby alerts</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
            <Text style={[type.body, { flex: 1 }]}>Tell me about new jams and people out here</Text>
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

        {/* Invites */}
        <Card>
          <Text style={type.h2}>Your invites</Text>
          <Text style={type.small}>OUTHERENOW grows by word of mouth. Share a code with someone you’d want to jam with.</Text>
          {invites.map((i) => (
            <View key={i.code} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
              <Text style={[type.body, { fontWeight: '800', letterSpacing: 1, opacity: i.used_by ? 0.4 : 1 }]}>{i.code}</Text>
              {i.used_by ? (
                <Text style={type.small}>Used</Text>
              ) : (
                <Button
                  title="Share"
                  variant="ghost"
                  onPress={() => Share.share({ message: `Come find us on OUTHERENOW 📍 Your invite code: ${i.code}` })}
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
