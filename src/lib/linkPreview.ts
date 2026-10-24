import { supabase } from './supabase';

// Best-effort details for a pasted link (supabase/functions/link-preview).
// Whatever comes back fills empty form fields; the rest is typed by hand.

export type LinkPreview = { title?: string; description?: string; image?: string; date?: string };

export type PostPlatform = 'medium' | 'linkedin' | 'x' | 'facebook' | 'instagram' | 'youtube' | 'website';

const YT = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/;

/** A YouTube video's thumbnail, worked out from the link alone (no request). */
export const youTubeThumbnail = (url: string) => {
  const id = url.match(YT)?.[1];
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : undefined;
};

/** The platform a link belongs to, for the post's badge. */
export function platformOf(url: string): PostPlatform {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return 'website'; }
  if (host === 'medium.com' || host.endsWith('.medium.com')) return 'medium';
  if (host.endsWith('linkedin.com')) return 'linkedin';
  if (host === 'x.com' || host === 'twitter.com' || host.endsWith('.twitter.com')) return 'x';
  if (host.endsWith('facebook.com') || host === 'fb.watch' || host === 'fb.com') return 'facebook';
  if (host.endsWith('instagram.com')) return 'instagram';
  if (host.endsWith('youtube.com') || host === 'youtu.be') return 'youtube';
  return 'website';
}

export async function fetchLinkPreview(url: string): Promise<{ preview: LinkPreview; error: string | null }> {
  const fallback: LinkPreview = { image: youTubeThumbnail(url) };
  try {
    const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } });
    if (error) {
      const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
      return { preview: fallback, error: body?.error ?? error.message };
    }
    const d = (data ?? {}) as LinkPreview;
    return { preview: { ...d, image: d.image || fallback.image }, error: null };
  } catch (e) {
    return { preview: fallback, error: e instanceof Error ? e.message : String(e) };
  }
}
