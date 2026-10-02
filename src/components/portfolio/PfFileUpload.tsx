import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FileText, Upload, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { Button } from '../ui/Button';

// Public bucket from migration 028; files are kept under `<user_id>/`.
export const PF_BUCKET = 'portfolio';

/** Object path inside the bucket, if `url` is one of our public URLs. */
const pathInBucket = (url: string | null) => {
  const marker = `/storage/v1/object/public/${PF_BUCKET}/`;
  const at = url?.indexOf(marker) ?? -1;
  return url && at >= 0 ? decodeURIComponent(url.slice(at + marker.length)) : null;
};

type Props = {
  userId: string;
  /** Translation key. */
  label: string;
  /** File name prefix inside the user's folder, e.g. "resume". */
  name: string;
  accept: string;
  url: string | null;
  /** Persists the new URL (null when removed); the upload is wasted if this fails. */
  onChange: (url: string | null) => Promise<void>;
};

/**
 * Uploads one file to the portfolio bucket and hands back its public URL.
 * The file a previous upload left behind is deleted once the new URL is saved.
 */
export const PfFileUpload = ({ userId, label, name, accept, url, onChange }: Props) => {
  const { t } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const removeOld = async (oldUrl: string | null) => {
    const old = pathInBucket(oldUrl);
    // Only ever delete inside this user's own folder.
    if (old?.startsWith(`${userId}/`)) await supabase.storage.from(PF_BUCKET).remove([old]);
  };

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin';
      // A fresh name per upload, so browsers and CDNs never serve the old file.
      const path = `${userId}/${name}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(PF_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(PF_BUCKET).getPublicUrl(path);
      await onChange(data.publicUrl);
      await removeOld(url);
      toast.success(t('pf.upload.uploaded'));
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.upload.error')));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await onChange(null);
      await removeOld(url);
      toast.success(t('pf.common.deleted'));
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.deleteError')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t(label)}</span>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3">
        <FileText size={20} className="text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0 text-sm">
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-full">
              <span className="truncate">{decodeURIComponent(url.split('/').pop() ?? url)}</span>
              <ExternalLink size={14} className="shrink-0" />
            </a>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">{t('pf.upload.none')}</span>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }}
        />
        <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={busy}>
          <Upload size={14} className="mr-1.5" />
          {busy ? t('pf.upload.uploading') : url ? t('pf.upload.replace') : t('pf.upload.upload')}
        </Button>
        {url && (
          <Button size="sm" variant="ghost" onClick={() => void remove()} disabled={busy} title={t('pf.common.delete')}>
            <Trash2 size={14} className="text-danger" />
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('pf.upload.hint')}</p>
    </div>
  );
};
