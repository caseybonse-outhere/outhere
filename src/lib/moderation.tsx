import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import { block, report } from './data';
import type { LegalDocId } from './legal';
import { colors, space, type } from './theme';
import type { ReportTarget } from './types';

const REASONS = ['Offensive or abusive', 'Spam or fake', 'Unsafe or dangerous', 'Something else'];

/** Ask why, file the report, and thank the reporter. */
export function reportContent(reporterId: string, targetType: ReportTarget, targetId: string, what: string) {
  Alert.alert(`Report this ${what}?`, 'What’s wrong with it? We review every report within 24 hours.', [
    ...REASONS.map((reason) => ({
      text: reason,
      onPress: async () => {
        const { error } = await report(reporterId, targetType, targetId, reason);
        if (error) Alert.alert('Couldn’t send your report', error.message);
        else Alert.alert('Thanks for letting us know', 'We’ll review it within 24 hours. You can also block this person to hide their posts.');
      },
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

/** Block someone after a confirmation. Their posts and camps disappear for you. */
export function blockPerson(blockerId: string, blockedId: string, name: string | undefined, onDone?: () => void) {
  Alert.alert(`Block ${name ?? 'this person'}?`, 'You won’t see their check-ins, lines, reviews or camps anymore.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Block',
      style: 'destructive',
      onPress: async () => {
        const { error } = await block(blockerId, blockedId);
        if (error && error.code !== '23505') Alert.alert('Couldn’t block', error.message);
        onDone?.();
      },
    },
  ]);
}

/** Report / block menu for something a person posted (a line, a check-in, a camp). */
export function postMenu(opts: {
  me: string;
  ownerId: string | null | undefined;
  ownerName?: string;
  targetType: ReportTarget;
  targetId: string;
  what: string;
  onBlocked?: () => void;
}) {
  const { me, ownerId, ownerName, targetType, targetId, what, onBlocked } = opts;
  if (ownerId === me) return;
  Alert.alert(ownerName ?? 'Options', undefined, [
    { text: `Report this ${what}`, onPress: () => reportContent(me, targetType, targetId, what) },
    ...(ownerId ? [{ text: `Block ${ownerName ?? 'this person'}`, style: 'destructive' as const, onPress: () => blockPerson(me, ownerId, ownerName, onBlocked) }] : []),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

/** Small text button: "Report camp", "Report spot"… */
export function ReportLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' }}>
      <Ionicons name="flag-outline" size={16} color={colors.muted} />
      <Text style={[type.small, { fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

/** "Terms · Community Guidelines · Privacy" row of links. */
export function LegalLinks({ docs = ['terms', 'guidelines', 'privacy'] }: { docs?: LegalDocId[] }) {
  const label: Record<LegalDocId, string> = { terms: 'Terms', guidelines: 'Community Guidelines', privacy: 'Privacy', support: 'Support' };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: space.md }}>
      {docs.map((d) => (
        <View key={d}>
          <Pressable accessibilityRole="link" onPress={() => router.push(`/legal/${d}`)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs }}>
            <Text style={[type.small, { color: colors.coralDark, fontWeight: '700' }]}>{label[d]}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
