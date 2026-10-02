// Supabase Edge Function: push notifications for Out Here.
//  • events / sessions / lines INSERT → members whose alert radius covers the spot
//  • messages INSERT → the recipient
// Triggered by Database Webhooks (see README). Deploy:
//   npx supabase functions deploy notify-nearby --no-verify-jwt
//   npx supabase secrets set WEBHOOK_SECRET=<random string>

import { createClient } from 'npm:@supabase/supabase-js@2';

type Table = 'events' | 'sessions' | 'lines' | 'messages';
type WebhookPayload = { type: 'INSERT' | 'UPDATE' | 'DELETE'; table: Table; record: Record<string, unknown> };
type Push = { to: string; title: string; body: string; sound: 'default'; data: Record<string, string> };

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const LINE_LABEL: Record<string, string> = {
  slackline: 'Slackline',
  trickline: 'Trickline',
  longline: 'Longline',
  highline: 'Highline',
  waterline: 'Waterline',
  rodeo: 'Rodeo line',
};

async function displayName(id: string | null): Promise<string> {
  if (!id) return 'Someone';
  const { data } = await supabase.from('profiles').select('display_name').eq('id', id).single();
  return data?.display_name ?? 'Someone';
}

async function send(messages: Push[]) {
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }
}

async function notifyRecipient(rec: Record<string, unknown>) {
  const { data: to } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', rec.recipient_id)
    .single();
  if (!to?.push_token) return 'no token';
  // Respect blocks in either direction.
  const { count } = await supabase
    .from('blocks')
    .select('*', { count: 'exact', head: true })
    .or(`and(blocker_id.eq.${rec.recipient_id},blocked_id.eq.${rec.sender_id}),and(blocker_id.eq.${rec.sender_id},blocked_id.eq.${rec.recipient_id})`);
  if (count) return 'blocked';
  const from = await displayName(rec.sender_id as string);
  const body = String(rec.body ?? '');
  await send([
    {
      to: to.push_token,
      title: from,
      body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
      sound: 'default',
      data: { messageFrom: String(rec.sender_id) },
    },
  ]);
  return 'sent 1';
}

async function notifyNearby(table: Table, rec: Record<string, unknown>) {
  const { data: spot } = await supabase.from('spots').select('name, lat, lng, is_public').eq('id', rec.spot_id).single();
  if (!spot || !spot.is_public) return 'no public spot';

  const creator = (table === 'events' ? rec.created_by : rec.user_id) as string | null;
  const who = await displayName(creator);

  const { data: members } = await supabase.rpc('members_near', { p_lat: spot.lat, p_lng: spot.lng, p_exclude: creator });
  const tokens: string[] = (members ?? []).map((m: { push_token: string }) => m.push_token).filter(Boolean);
  if (tokens.length === 0) return 'nobody nearby';

  let title: string;
  let body: string;
  if (table === 'events') {
    title = `New jam: ${rec.name}`;
    body = `At ${spot.name}. Tap to see when.`;
  } else if (table === 'lines') {
    const kind = LINE_LABEL[String(rec.line_type)] ?? 'Slackline';
    title = `The line is up at ${spot.name}`;
    body = `${who} rigged a ${kind.toLowerCase()}${rec.length_ft ? ` (${rec.length_ft} ft)` : ''}. Pull up!`;
  } else {
    title = `${who} is out here`;
    body = `At ${spot.name}${rec.activity ? ` · ${rec.activity}` : ''}. Pull up!`;
  }

  await send(tokens.map((to) => ({ to, title, body, sound: 'default' as const, data: { spotId: String(rec.spot_id) } })));
  return `sent ${tokens.length}`;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }
  const payload = (await req.json()) as WebhookPayload;
  if (payload.type !== 'INSERT') return new Response('ignored');

  const result = payload.table === 'messages' ? await notifyRecipient(payload.record) : await notifyNearby(payload.table, payload.record);
  return new Response(result);
});
