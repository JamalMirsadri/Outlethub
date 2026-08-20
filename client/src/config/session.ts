const FIXED_INACTIVITY_TIMEOUT_MINUTES = 12 * 60;
const DEFAULT_ACTIVITY_PING_INTERVAL_MS = 5 * 60 * 1000;

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const AUTH_INACTIVITY_TIMEOUT_MS = FIXED_INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;

export const AUTH_ACTIVITY_PING_INTERVAL_MS = parsePositiveNumber(
  import.meta.env.VITE_AUTH_ACTIVITY_PING_INTERVAL_MS,
  DEFAULT_ACTIVITY_PING_INTERVAL_MS,
);
