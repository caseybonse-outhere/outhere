import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, View } from 'react-native';
import { colors, radius } from './theme';
import type { JamEvent } from './types';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Slackline: 'remove-outline',
  'Flow Arts': 'sparkles',
  Dance: 'musical-notes',
  Acro: 'people',
  Yoga: 'leaf',
  Hiking: 'trail-sign',
  Parkour: 'walk',
  Juggling: 'ellipse',
  'Rings & Gymnastics': 'fitness',
};

/** Jam cover photo, or a branded placeholder showing the jam's main discipline. */
export function JamThumb({ jam, size = 72, rounded = radius.md }: { jam: Pick<JamEvent, 'cover_url' | 'name' | 'disciplines'>; size?: number; rounded?: number }) {
  if (jam.cover_url) {
    return (
      <Image
        source={{ uri: jam.cover_url }}
        accessibilityLabel={`${jam.name} photo`}
        style={{ width: size, height: size, borderRadius: rounded, backgroundColor: colors.sand2 }}
      />
    );
  }
  const icon = ICONS[jam.disciplines?.[0] ?? ''] ?? 'sunny';
  return (
    <View
      accessibilityLabel={`${jam.name}, no photo`}
      style={{ width: size, height: size, borderRadius: rounded, backgroundColor: colors.dusk, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={size * 0.42} color={colors.gold} />
    </View>
  );
}
