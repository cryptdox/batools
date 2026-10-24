// Supabase Edge Function: link-preview
//
// Reads a public page's preview data (title, description, image, date) so
// batools can fill in a post or link card from a pasted URL. Best effort:
// many sites (LinkedIn, Facebook, Instagram) hide this from servers, and then
// the caller simply gets fewer fields and the user types the rest.
//
// Only signed-in batools users may call it: the request's x-iam-token must be
// a valid, unexpired HS256 token signed with IAM's realm secret (the same check
// the database does, migration 047). Deploy and configure once:
//
//   supabase functions deploy link-preview --no-verify-jwt
//   supabase secrets set IAM_JWT_SECRET=<CRYPTDOX realm SECRET>
//
// (--no-verify-jwt because batools calls with a publishable key, not a JWT;
// the IAM check below replaces Supabase's.)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-iam-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const b64urlToBytes = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));

/** True when the token is an unexpired HS256 JWT signed with IAM's secret. */
async function validIamToken(token: string | null, secret: string): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return false;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() && !!payload.userId;
  } catch {
    return false;
  }
}

/** Refuse anything but public http(s) hosts (no localhost / private ranges). */
function publicUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string') return null;
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host === '[::1]') return null;
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return null;
  }
  if (host.startsWith('[')) return null; // IPv6 literals: not needed for previews
  return url;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()] ?? m,
  ).replace(/\s+/g, ' ').trim();

/** content of <meta property|name="key" content="…"> for the first key present. */
function meta(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (content && content.trim()) return decode(content);
  }
  return undefined;
}

const YT = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/;

async function preview(url: URL) {
  // YouTube: oEmbed is reliable where the page itself is not.
  const yt = url.href.match(YT)?.[1];
  if (yt) {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.href)}`, { signal: AbortSignal.timeout(8000) });
    const o = res.ok ? await res.json() : {};
    return { title: o.title, description: o.author_name ? `by ${o.author_name}` : undefined, image: `https://img.youtube.com/vi/${yt}/hqdefault.jpg` };
  }

  const res = await fetch(url.href, {
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; batools-link-preview/1.0; +https://github.com/cryptdox/batools)', accept: 'text/html,application/xhtml+xml' },
  });
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return {};
  // The <head> is all we need; stop reading after ~512 KB.
  const reader = res.body!.getReader();
  let html = '';
  const decoder = new TextDecoder();
  while (html.length < 512_000) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    if (/<\/head>/i.test(html)) break;
  }
  reader.cancel().catch(() => {});

  const title = meta(html, ['og:title', 'twitter:title']) ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] && decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]));
  const description = meta(html, ['og:description', 'twitter:description', 'description']);
  const rawImage = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
  const image = rawImage ? new URL(rawImage, res.url || url.href).href : undefined;
  const rawDate = meta(html, ['article:published_time', 'og:article:published_time', 'datePublished', 'pubdate', 'date']);
  const date = rawDate && !Number.isNaN(Date.parse(rawDate)) ? new Date(rawDate).toISOString().slice(0, 10) : undefined;
  return { title, description, image, date };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const secret = Deno.env.get('IAM_JWT_SECRET');
  if (!secret) return json({ error: 'IAM_JWT_SECRET is not set on this function' }, 500);
  if (!(await validIamToken(req.headers.get('x-iam-token'), secret))) return json({ error: 'Sign in to batools to fetch link details' }, 401);

  const body = await req.json().catch(() => null);
  const url = publicUrl(body?.url);
  if (!url) return json({ error: 'Not a public http(s) link' }, 400);

  try {
    return json(await preview(url));
  } catch {
    // Unreachable or slow sites: no details, not an error the user must act on.
    return json({});
  }
});
