export const ZONE_OFFLINE_THRESHOLD_SECONDS = 5;

export function isZoneOffline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return true;
  const lastSeenMs = new Date(lastSeenAt).getTime();
  if (isNaN(lastSeenMs)) return true;
  return (Date.now() - lastSeenMs) / 1000 > ZONE_OFFLINE_THRESHOLD_SECONDS;
}
