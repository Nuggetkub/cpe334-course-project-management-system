/** Shared with F-05; formatting never depends on the browser's timezone. */
export function formatBangkok(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")} (ICT)`;
}

/** datetime-local is explicitly Bangkok input, not the user's host timezone. */
export function bangkokInputToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  const date = new Date(`${value}:00+07:00`);
  if (!Number.isFinite(date.getTime()) || Number(y) < 1) return null;
  const local = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  if (local.getUTCFullYear() !== Number(y) || local.getUTCMonth() + 1 !== Number(m) || local.getUTCDate() !== Number(d)
    || local.getUTCHours() !== Number(h) || local.getUTCMinutes() !== Number(min)) return null;
  return date.toISOString();
}
