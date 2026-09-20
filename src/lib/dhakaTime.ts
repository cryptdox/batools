const DHAKA_TZ = 'Asia/Dhaka';

// Bangladesh has a fixed UTC+6 offset year-round (no DST), so attendance
// times are always meant as Asia/Dhaka wall-clock regardless of the
// viewer's own machine timezone.
export function getDhakaTimeOfDay(isoString: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DHAKA_TZ,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(isoString));
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
  return `${get('hour')}:${get('minute')}:${get('second')}`;
}

export function formatDhakaTime12h(isoString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DHAKA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString));
}

// Builds a correct UTC instant for a given calendar date + "HH:mm" wall-clock
// time meant as Asia/Dhaka, independent of the editing browser's own timezone.
export function dhakaDateTimeToIso(dbDate: string, timeHHmm: string): string {
  return `${dbDate}T${timeHHmm}:00+06:00`;
}
