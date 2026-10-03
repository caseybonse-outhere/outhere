import * as SunCalc from 'suncalc';
import type { JamEvent } from './types';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Start time of the event on a given calendar day (local time). */
export function startOnDay(event: JamEvent, day: Date, lat: number, lng: number): Date {
  if (event.start_type === 'sunset') {
    // Use midday so SunCalc picks the right date regardless of timezone edge cases.
    const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
    // Fall back to 7 pm if sunset can't be computed (polar edge cases).
    const sunset = SunCalc.getTimes(noon, lat, lng).sunset ?? new Date(day.getFullYear(), day.getMonth(), day.getDate(), 19);
    return new Date(sunset.getTime() + (event.sunset_offset_min ?? 0) * 60000);
  }
  const [h, m] = (event.start_time ?? '00:00').split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

function occursOn(event: JamEvent, day: Date): boolean {
  if (event.recurrence === 'once') {
    return !!event.start_date && startOfDay(parseDateOnly(event.start_date)).getTime() === day.getTime();
  }
  if (day.getDay() !== event.day_of_week) return false;
  if (event.recurrence === 'biweekly' && event.start_date) {
    const anchor = startOfDay(parseDateOnly(event.start_date));
    const weeks = Math.round((day.getTime() - anchor.getTime()) / (7 * DAY_MS));
    return weeks >= 0 && weeks % 2 === 0;
  }
  return true;
}

export type Occurrence = { start: Date; end: Date; happeningNow: boolean };

/** The next (or current) occurrence of an event, looking up to ~10 weeks ahead. */
export function nextOccurrence(event: JamEvent, lat: number, lng: number, from = new Date()): Occurrence | null {
  let day = startOfDay(from);
  for (let i = 0; i < 70; i++) {
    if (occursOn(event, day)) {
      const start = startOnDay(event, day, lat, lng);
      const end = new Date(start.getTime() + (event.duration_min ?? 180) * 60000);
      if (end > from) return { start, end, happeningNow: start <= from };
    }
    day = new Date(day.getTime() + DAY_MS);
    day = startOfDay(new Date(day.getTime() + 2 * 3600 * 1000)); // guard against DST shifts
  }
  return null;
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatWhen(occ: Occurrence, now = new Date()): string {
  if (occ.happeningNow) return `Happening now · until ${formatTime(occ.end)}`;
  const today = startOfDay(now).getTime();
  const day = startOfDay(occ.start).getTime();
  const diff = Math.round((day - today) / DAY_MS);
  const dayLabel =
    diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : occ.start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${dayLabel} · ${formatTime(occ.start)}`;
}

export function describeSchedule(event: JamEvent): string {
  const start =
    event.start_type === 'sunset'
      ? event.sunset_offset_min
        ? `${Math.abs(event.sunset_offset_min)} min ${event.sunset_offset_min < 0 ? 'before' : 'after'} sunset`
        : 'at sunset'
      : `at ${formatTime(startOnDay(event, new Date(2000, 0, 1), 0, 0))}`;
  if (event.recurrence === 'once') return `One-off ${start}`;
  const every = event.recurrence === 'biweekly' ? 'Every other' : 'Every';
  return `${every} ${DAY_NAMES[event.day_of_week]} ${start}`;
}

/** Sunset today at a location, for "here until sunset" sessions. */
export function sunsetToday(lat: number, lng: number): Date {
  const now = new Date();
  return SunCalc.getTimes(now, lat, lng).sunset ?? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19);
}

/** Local calendar date (YYYY-MM-DD) of a moment — used to key "going" sign-ups to a session. */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "today", "tomorrow", or the weekday name, for "Going Wednesday" style labels. */
export function dayLabel(d: Date, now = new Date()): string {
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return DAY_NAMES[d.getDay()];
}
