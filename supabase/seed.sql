-- Out Here — seed data (from the Seed_Data spreadsheet)
-- Run after 0001_init.sql. Safe to edit and re-run pieces by hand.

-- Spots
-- NOTE: Original Muscle Beach coordinates are approximate — drop a pin in Maps and update them.
insert into public.spots (id, name, address, lat, lng, hours, disciplines, features, surface, fire_allowed, lighting, is_public, notes)
values
  ('11111111-1111-4111-8111-111111111111',
   'Original Muscle Beach',
   'Just south of Santa Monica Pier, Ocean Front Walk, Santa Monica, CA 90401',
   34.0079, -118.4958,
   'Open daily',
   array['Slackline', 'Acro', 'Rings & Gymnastics', 'Flow Arts', 'Dance'],
   'Traveling rings (beginner + full-size sets); slackline park with fixed 6 ft poles (20–100+ ft lines) and 10 ft longline poles; padded gymnastics area; bars',
   'Sand', 'unknown', 'unknown', true,
   'Historic landmark. Bring your own slackline / ratchet straps.'),
  ('22222222-2222-4222-8222-222222222222',
   'South Beach Park',
   '3400 Barnard Way, Santa Monica, CA 90405',
   33.99673, -118.48241,
   '7:00 am – 10:00 pm',
   array['Flow Arts', 'Dance'],
   'Grass area, picnic tables, playground; paid beach parking lot',
   'Grass', 'unknown', 'unknown', true,
   'Beachfront park bordering Venice.')
on conflict (id) do nothing;

-- Weekly jams
insert into public.events (name, spot_id, disciplines, recurrence, day_of_week, start_type, start_time, sunset_offset_min, duration_min, description)
values
  ('Wiggle Wednesdays', '11111111-1111-4111-8111-111111111111',
   array['Slackline', 'Dance', 'Flow Arts'], 'weekly', 3, 'fixed', '16:00', 0, 180, null),
  ('Glow Flow', '22222222-2222-4222-8222-222222222222',
   array['Flow Arts', 'Dance'], 'weekly', 3, 'sunset', null, 0, 180, null),
  ('Drop Squad Sunday', '11111111-1111-4111-8111-111111111111',
   array['Slackline', 'Flow Arts', 'Dance'], 'weekly', 0, 'fixed', '16:00', 0, 180, null);
