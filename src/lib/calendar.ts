import * as Calendar from 'expo-calendar/legacy';
import { Alert, Linking } from 'react-native';
import { describeSchedule, type Occurrence } from './schedule';
import type { JamEvent } from './types';

/** Opens the system "new event" sheet pre-filled with the jam, repeating weekly when it's a regular jam. */
export async function addJamToCalendar(event: JamEvent, occ: Occurrence) {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Calendar access is off',
        'To add camps to your calendar, allow calendar access for this app in the iPhone Settings app.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    const repeating = event.recurrence !== 'once';
    await Calendar.createEventInCalendarAsync({
      title: event.name,
      startDate: occ.start,
      endDate: occ.end,
      location: event.spot?.address ?? event.spot?.name ?? undefined,
      notes: [describeSchedule(event), event.start_type === 'sunset' ? 'Starts at sunset — the exact time shifts through the year.' : null, event.description]
        .filter(Boolean)
        .join('\n'),
      recurrenceRule: repeating
        ? { frequency: Calendar.Frequency.WEEKLY, interval: event.recurrence === 'biweekly' ? 2 : 1 }
        : undefined,
    });
  } catch (e) {
    Alert.alert('Couldn’t open your calendar', e instanceof Error ? e.message : String(e));
  }
}
