import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, Switch, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { Avatar, pickAndUploadAvatar } from '../../lib/avatar';
import { fetchOpenReports } from '../../lib/data';
import { notificationsAllowed, registerForPush, syncHomeArea } from '../../lib/device';
import { deleteMyFiles } from '../../lib/images';
import { LegalLinks } from '../../lib/moderation';
import { supabase } from '../../lib/supabase';
import { colors, space, type } from '../../lib/theme';
import { DISCIPLINES, INTERESTS, type Profile } from '../../lib/types';
import { Button, Card, ChipGroup, Field, Screen, Segmented } from '../../lib/ui';

const RADII = [1, 5, 10, 25, 50];

export default function Me() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable copy of the profile.
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  const [pushOn, setPushOn] = useState(true);
  useEffect(() => {
    notificationsAllowed().then(setPushOn);
  }, []);

  // Admins see how many reports are waiting.
  const isAdmin = !!profile?.is_admin;
  const [openReports, setOpenReports] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) return;
      fetchOpenReports()
        .then((r) => setOpenReports(r.length))
        .catch(() => setOpenReports(null));
    }, [isAdmin]),
  );

  // Copy the saved profile into the form whenever it changes (adjusting state during render, per React docs).
  const savedSig = profile ? JSON.stringify([profile.id, profile.display_name, profile.bio, profile.disciplines, profile.interests]) : '';
  const [syncedSig, setSyncedSig] = useState('');
  if (profile && savedSig !== syncedSig) {
    setSyncedSig(savedSig);
    setName(profile.display_name);
    setBio(profile.bio ?? '');
    setDisciplines(profile.disciplines ?? []);
    setInterests(profile.interests ?? []);
  }


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

  async function toggleAlerts(on: boolean) {
    await update({ alerts_enabled: on });
    if (on) await turnOnAlerts();
  }

  /** Ask for notifications and location only when someone actually wants alerts. */
  async function turnOnAlerts() {
    const token = await registerForPush(profile!.id, true);
    if (!token && !(await notificationsAllowed())) {
      Alert.alert('Notifications are off', 'To get nearby alerts, allow notifications for this app in the iPhone Settings app.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
    }
    if (profile!.home_lat == null) await syncHomeArea(profile!.id, true);
    setPushOn(await notificationsAllowed());
    await refreshProfile();
  }

  function confirmDelete() {
    Alert.alert('Delete your account?', 'This permanently deletes your profile, photos, reviews, check-ins, lines and the camps you started. It can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMyFiles(profile!.id).catch(() => undefined); // photos first, while we still own them
          const { error } = await supabase.rpc('delete_my_account');
          if (error) Alert.alert('Couldn’t delete account', error.message);
          else await signOut();
        },
      },
    ]);
  }

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
            <Text style={[type.body, { flex: 1 }]}>Tell me about new camps and people out here</Text>
            <Switch
              value={profile.alerts_enabled}
              onValueChange={toggleAlerts}
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
          {profile.alerts_enabled && !pushOn && (
            <View style={{ alignSelf: 'flex-start' }}>
              <Button title="Turn on notifications" variant="secondary" onPress={turnOnAlerts} />
            </View>
          )}
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

        {/* Share */}
        <Card>
          <Text style={type.h2}>Bring your crew</Text>
          <Text style={type.small}>Out Here Now is better with more people out here. Send it to the folks you train with.</Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button title="Share Out Here Now" variant="ghost" onPress={() => Share.share({ message: 'Come find us on Out Here Now 📍 Adventure, camps and who’s out right now. https://outherenow.app' })} />
          </View>
        </Card>

        {profile.is_admin && (
          <Card>
            <Text style={type.h2}>Moderation</Text>
            <Text style={type.small}>
              {openReports == null ? 'Reports people have sent.' : openReports === 0 ? 'No open reports. Nice.' : `${openReports} open ${openReports === 1 ? 'report' : 'reports'} — review within 24 hours.`}
            </Text>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button title="Review reports" variant={openReports ? 'primary' : 'ghost'} onPress={() => router.push('/admin')} />
            </View>
          </Card>
        )}

        {/* Help & legal */}
        <Card>
          <Text style={type.h2}>Help & safety</Text>
          <Text style={type.small}>Report anything that breaks the rules from its page, or long-press a person to report or block them.</Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button title="Contact support" variant="ghost" onPress={() => router.push('/support')} />
          </View>
          <LegalLinks />
        </Card>

        <Button title="Sign out" variant="secondary" onPress={signOut} />
        <Button title="Delete account" variant="danger" onPress={confirmDelete} />
      </ScrollView>
    </Screen>
  );
}
