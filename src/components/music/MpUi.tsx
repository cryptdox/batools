import { useState } from 'react';
import { Lock, Music2, Pause, Play, Star } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { usePlayer } from '../../lib/MusicPlayerContext';
import { canPlay, useMpUserId, type MpRatingStat, type MpSong } from '../../lib/music';

/** Square cover that always fills its box (object-fit: cover); a gradient when there is none. */
export const MpCover = ({ url, color = '#6c5ce7', className = '', rounded = 'rounded-lg', alt = '' }: {
  url: string | null | undefined; color?: string; className?: string; rounded?: string; alt?: string;
}) => (
  <div className={`relative overflow-hidden shrink-0 ${rounded} ${className}`} style={url ? undefined : { background: `linear-gradient(135deg, ${color}, #131d3d)` }}>
    {url
      ? <img src={url} alt={alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      : <Music2 className="absolute inset-0 m-auto text-white/70 w-1/3 h-1/3" />}
  </div>
);

/** Three bouncing bars: "this one is playing". */
export const MpPlayingBars = ({ active }: { active: boolean }) => (
  <span className="inline-flex items-end gap-[2px] h-3.5" aria-hidden="true">
    {[0, 1, 2].map(i => (
      <span
        key={i}
        className="w-[3px] rounded-sm bg-primary origin-bottom"
        style={{ height: '100%', animation: active ? `mp-bar 0.9s ${i * 0.15}s ease-in-out infinite` : 'none', transform: active ? undefined : 'scaleY(0.35)' }}
      />
    ))}
  </span>
);

/** Play / pause for one song; locked when it is paid and not yours. */
export const MpPlayButton = ({ song, list, size = 36 }: { song: MpSong; list?: MpSong[]; size?: number }) => {
  const { t } = useLanguage();
  const userId = useMpUserId();
  const { current, playing, playList, playNow, toggle } = usePlayer();
  const isCurrent = current?.id === song.id;
  const locked = !canPlay(song, userId);
  const onClick = () => {
    if (locked) return;
    if (isCurrent) return toggle();
    if (list) return playList(list, list.indexOf(song));
    playNow(song);
  };
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick(); }}
      disabled={locked}
      title={locked ? t('mp.paidLocked') : isCurrent && playing ? t('mp.pause') : t('mp.play')}
      aria-label={locked ? t('mp.paidLocked') : isCurrent && playing ? t('mp.pause') : t('mp.play')}
      className={`inline-flex items-center justify-center rounded-full shrink-0 transition-transform ${locked
        ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
        : 'bg-primary text-white hover:scale-105 shadow-md'}`}
      style={{ width: size, height: size }}
    >
      {locked ? <Lock size={size * 0.42} /> : isCurrent && playing ? <Pause size={size * 0.45} fill="currentColor" /> : <Play size={size * 0.45} fill="currentColor" className="ml-0.5" />}
    </button>
  );
};

/**
 * Five stars. Filled to your own rating when you have one (primary colour),
 * otherwise to the average (amber). Click a star to rate; click your current
 * rating again to clear it. Shows "avg (count)" next to them.
 */
export const MpStars = ({ stat, mine, onRate, size = 14, showCount = true, className = '' }: {
  stat?: MpRatingStat; mine?: number; onRate?: (n: number) => void; size?: number; showCount?: boolean; className?: string;
}) => {
  const { t } = useLanguage();
  const [hover, setHover] = useState(0);
  const shown = hover || mine || stat?.avg || 0;
  const own = hover > 0 || !!mine;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} onClick={e => e.stopPropagation()}>
      <span className="inline-flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => {
          const fill = Math.max(0, Math.min(1, shown - (n - 1)));
          return (
            <button
              key={n}
              type="button"
              disabled={!onRate}
              onMouseEnter={() => onRate && setHover(n)}
              onClick={() => onRate?.(n)}
              title={onRate ? (mine === n ? t('mp.rating.clear') : t('mp.rating.rate').replace('{n}', String(n))) : undefined}
              aria-label={t('mp.rating.rate').replace('{n}', String(n))}
              className={`relative p-px ${onRate ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <Star size={size} className="text-gray-300 dark:text-gray-600" />
              <span className="absolute inset-0 p-px overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star size={size} className={own ? 'text-primary' : 'text-amber-400'} fill="currentColor" />
              </span>
            </button>
          );
        })}
      </span>
      {showCount && (
        <span className="text-[11px] tabular-nums text-gray-500">
          {stat ? `${stat.avg.toFixed(1)} (${stat.count})` : t('mp.rating.none')}
        </span>
      )}
    </span>
  );
};
