import { Text, View } from 'react-native';
import { space, type } from './theme';
import { DISCIPLINE_DETAILS, type Discipline } from './types';
import { ChipGroup } from './ui';

/** The detail options for an activity, if it has any (Juggling, Staff). */
export function detailOptions(activity: string | null | undefined): readonly string[] {
  return activity ? (DISCIPLINE_DETAILS[activity as Discipline] ?? []) : [];
}

/** The options picked for one activity, from "Activity: Option" tags. */
export function detailsFor(activity: string, tags: readonly string[] | null | undefined): string[] {
  const prefix = `${activity}: `;
  const allowed = detailOptions(activity);
  return (tags ?? []).filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length)).filter((o) => allowed.includes(o));
}

/** Keep only tags that belong to the given activities (drops details of activities no longer picked). */
export function keepDetails(tags: readonly string[], activities: readonly string[]): string[] {
  return tags.filter((t) => activities.some((a) => detailsFor(a, [t]).length > 0));
}

/** "Juggling (clubs, wants to pass)" or just "Juggling". */
export function describeActivity(activity: string, tags: readonly string[] | null | undefined): string {
  const picked = detailsFor(activity, tags);
  return picked.length ? `${activity} (${picked.map((o) => o.toLowerCase()).join(', ')})` : activity;
}

/**
 * Detail chips for one activity, e.g. Juggling → Balls · Clubs · Wants to pass.
 * `tags` holds every activity's tags; only this activity's are changed.
 */
export function ActivityDetails({ activity, tags, onChange }: { activity: string; tags: string[]; onChange: (tags: string[]) => void }) {
  const options = detailOptions(activity);
  if (options.length === 0) return null;
  const prefix = `${activity}: `;
  const others = tags.filter((t) => !t.startsWith(prefix));
  return (
    <View style={{ gap: space.xs }}>
      <Text style={type.small}>{activity} details</Text>
      <ChipGroup
        options={options}
        value={detailsFor(activity, tags)}
        onChange={(picked) => onChange([...others, ...options.filter((o) => picked.includes(o)).map((o) => prefix + o)])}
      />
    </View>
  );
}
