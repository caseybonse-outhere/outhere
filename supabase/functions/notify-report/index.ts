// Supabase Edge Function: email the Out Here Now admin about new reports and support messages,
// so reports get handled within 24 hours (an App Store requirement for apps with user posts).
//  • reports INSERT          → "New report: Camp — …"
//  • support_messages INSERT → "Support: …" (reply-to is the member's email)
// Triggered by Database Webhooks (see README). Deploy:
//   npx supabase secrets set RESEND_API_KEY=<re_...> ADMIN_EMAIL=<where to send> FROM_EMAIL="Out Here Now <alerts@yourdomain>"
//   npx supabase functions deploy notify-report --no-verify-jwt
// Uses the same WEBHOOK_SECRET as notify-nearby.

import { createClient } from 'npm:@supabase/supabase-js@2';

type WebhookPayload = { type: 'INSERT' | 'UPDATE' | 'DELETE'; table: 'reports' | 'support_messages'; record: Record<string, unknown> };

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const KIND: Record<string, string> = {
  spot: 'Spot',
  review: 'Review',
  event: 'Camp',
  session: 'Check-in',
  profile: 'Profile',
  line: 'Line post',
};

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

async function member(id: unknown): Promise<{ name: string; email: string | null }> {
  if (typeof id !== 'string') return { name: 'Unknown', email: null };
  const [{ data: p }, { data: u }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', id).maybeSingle(),
    supabase.auth.admin.getUserById(id),
  ]);
  return { name: p?.display_name ?? 'Unknown', email: u?.user?.email ?? null };
}

async function preview(type: string, id: string): Promise<string> {
  const pick = async (table: string, cols: string) => (await supabase.from(table).select(cols).eq('id', id).maybeSingle()).data as Record<string, unknown> | null;
  const row =
    type === 'spot' ? await pick('spots', 'name, notes')
    : type === 'review' ? await pick('spot_reviews', 'rating, body')
    : type === 'event' ? await pick('events', 'name, description, cover_url')
    : type === 'session' ? await pick('sessions', 'activity, note')
    : type === 'line' ? await pick('lines', 'line_type, note')
    : type === 'profile' ? await pick('profiles', 'display_name, bio, avatar_url')
    : null;
  if (!row) return '(already removed)';
  return Object.values(row).filter((v) => v != null && v !== '').join(' — ');
}

async function sendEmail(subject: string, html: string, replyTo?: string | null) {
  const key = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('ADMIN_EMAIL');
  if (!key || !to) throw new Error('Set RESEND_API_KEY and ADMIN_EMAIL secrets');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('FROM_EMAIL') ?? 'Out Here Now <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }
  const payload = (await req.json()) as WebhookPayload;
  if (payload.type !== 'INSERT') return new Response('ignored');
  const r = payload.record;

  try {
    if (payload.table === 'reports') {
      const kind = KIND[String(r.target_type)] ?? String(r.target_type);
      const [reporter, what] = await Promise.all([member(r.reporter_id), preview(String(r.target_type), String(r.target_id))]);
      await sendEmail(
        `New report: ${kind} — ${what.slice(0, 60)}`,
        `<p><b>${escape(kind)}</b> reported by ${escape(reporter.name)}${r.reason ? ` — <i>${escape(String(r.reason))}</i>` : ''}</p>
         <blockquote>${escape(what)}</blockquote>
         <p>Open Out Here Now → Me → <b>Review reports</b> to remove it, ban the poster, or dismiss. Please handle it within 24 hours.</p>`,
      );
    } else if (payload.table === 'support_messages') {
      const from = await member(r.user_id);
      await sendEmail(
        `Support: ${String(r.body).slice(0, 60)}`,
        `<p>From <b>${escape(from.name)}</b>${from.email ? ` (${escape(from.email)})` : ''}</p>
         <blockquote style="white-space:pre-wrap">${escape(String(r.body))}</blockquote>
         <p>Reply to this email to answer them.</p>`,
        from.email,
      );
    }
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
  return new Response('ok');
});
