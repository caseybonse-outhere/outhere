// Supabase Edge Function: sends a push to members whose alert radius covers a new jam or "I'm here" session.
// Triggered by Database Webhooks on INSERT into public.events and public.sessions (see README).
// Deploy: npx supabase functions deploy notify-nearby --no-verify-jwt
// Secret: npx supabase secrets set WEBHOOK_SECRET=<random string>

import { createClient } from 'npm:@supabase/supabase-js@2';

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: 'events' | 'sessions';
  record: Record<string, unknown>;
};

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload = (await req.json()) as WebhookPayload;
  if (payload.type !== 'INSERT') return new Response('ignored');

  const rec = payload.record;
  const { data: spot } = await supabase.from('spots').select('name, lat, lng, is_public').eq('id', rec.spot_id).single();
  if (!spot || !spot.is_public) return new Response('no public spot');

  const creator = (payload.table === 'events' ? rec.created_by : rec.user_id) as string | null;
  const { data: creatorProfile } = creator
    ? await supabase.from('profiles').select('display_name').eq('id', creator).single()
    : { data: null };
  const who = creatorProfile?.display_name ?? 'Someone';

  const { data: members } = await supabase.rpc('members_near', {
    p_lat: spot.lat,
    p_lng: spot.lng,
    p_exclude: creator,
  });
  const tokens = (members ?? []).map((m: { push_token: string }) => m.push_token).filter(Boolean);
  if (tokens.length === 0) return new Response('nobody nearby');

  const title = payload.table === 'events' ? `New jam: ${rec.name}` : `${who} is out here`;
  const body =
    payload.table === 'events'
      ? `At ${spot.name}. Tap to see when.`
      : `At ${spot.name}${rec.activity ? ` · ${rec.activity}` : ''}. Pull up!`;

  const messages = tokens.map((to: string) => ({
    to,
    title,
    body,
    sound: 'default',
    data: { spotId: rec.spot_id },
  }));

  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }

  return new Response(`sent ${messages.length}`);
});
