import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { fetchOpenReports } from '../lib/data';
import { supabase } from '../lib/supabase';
import { colors, space, type } from '../lib/theme';
import type { OpenReport, ReportTarget } from '../lib/types';
import { Button, Card, Empty, Screen } from '../lib/ui';

const KIND: Record<ReportTarget, string> = {
  spot: 'Spot',
  review: 'Review',
  event: 'Camp',
  session: 'Check-in',
  profile: 'Profile',
  line: 'Line post',
};

/** Moderation queue: every open report, with Remove / Ban / Dismiss. Admins only. */
export default function Admin() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<OpenReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await fetchOpenReports());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!profile?.is_admin) return <Empty text="Only admins can see reports." />;

  async function act(fn: string, args: Record<string, string>, done: string) {
    const { error: e } = await supabase.rpc(fn, args);
    if (e) Alert.alert('Couldn’t do that', e.message);
    else {
      Alert.alert(done);
      load();
    }
  }

  function remove(r: OpenReport) {
    const what = KIND[r.target_type].toLowerCase();
    const detail = r.target_type === 'profile' ? 'Their bio and photo will be cleared.' : `The ${what} will be deleted for everyone.`;
    Alert.alert(`Remove this ${what}?`, detail, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => act('admin_remove', { p_report: r.id }, 'Removed.') },
    ]);
  }

  function ban(r: OpenReport) {
    if (!r.owner_id) return;
    Alert.alert(
      `Ban ${r.owner_name ?? 'this person'}?`,
      'They lose access right away, their check-ins, lines, reviews and camps are deleted, and their email can’t sign up again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Ban', style: 'destructive', onPress: () => act('admin_ban', { p_user: r.owner_id! }, 'Banned.') },
      ],
    );
  }

  function view(r: OpenReport) {
    if (r.target_type === 'spot') router.push(`/spot/${r.target_id}`);
    else if (r.target_type === 'event') router.push(`/camp/${r.target_id}`);
    else if (r.target_type === 'profile') router.push(`/profile/${r.target_id}`);
    else if (r.owner_id) router.push(`/profile/${r.owner_id}`);
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <Text style={type.small}>Apple expects reports to be handled within 24 hours. Remove what breaks the rules, ban people who post it, dismiss the rest.</Text>
        {error && (
          <Card>
            <Text style={type.h2}>Couldn’t load reports</Text>
            <Text style={type.small}>{error}</Text>
            <Button title="Try again" variant="ghost" onPress={load} />
          </Card>
        )}
        {!loading && !error && reports.length === 0 && <Empty text="No open reports. All clear." />}
        {reports.map((r) => (
          <Card key={r.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
              <Text style={[type.label, { color: colors.coralDark }]}>{KIND[r.target_type]}</Text>
              <Text style={type.small}>{new Date(r.created_at).toLocaleString()}</Text>
            </View>
            <Text style={type.body}>{r.preview}</Text>
            <Text style={type.small}>
              Posted by {r.owner_name ?? 'unknown'}
              {r.owner_banned ? ' (banned)' : ''} · reported by {r.reporter_name ?? 'a member'}
              {r.reason ? ` · ${r.reason}` : ''}
            </Text>
            <View style={{ gap: space.sm }}>
              <Button title="Remove" variant="danger" onPress={() => remove(r)} />
              {r.owner_id && !r.owner_banned && r.owner_id !== profile.id && (
                <Button title={`Ban ${r.owner_name ?? 'poster'}`} variant="secondary" onPress={() => ban(r)} />
              )}
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Button title="View" variant="ghost" onPress={() => view(r)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Dismiss" variant="ghost" onPress={() => act('admin_dismiss', { p_report: r.id }, 'Dismissed.')} />
                </View>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
