import type { RiskScoreHistoryEntry } from "../store/liveZoneStore";

const TREND_WINDOW_SIZE = 6;
const TREND_SLOPE_THRESHOLD = 2.0;
const TREND_PROXIMITY_FLOOR = 55.0;
const CRITICAL_THRESHOLD = 70.0;

export function computeTrendSlope(history: { score: number }[]): number {
  const n = history.length;
  if (n < 2) return 0;

  const sumX = (n - 1) * n / 2;
  const sumY = history.reduce((acc, h) => acc + h.score, 0);
  const sumXY = history.reduce((acc, h, i) => acc + i * h.score, 0);
  const sumX2 = (n - 1) * n * (2 * n - 1) / 6;

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

export function isZoneTrendingCritical(
  zoneId: string,
  riskScoreHistory: Record<string, RiskScoreHistoryEntry[]>,
  currentState: string,
): boolean {
  const history = riskScoreHistory[zoneId];
  if (!history || history.length < TREND_WINDOW_SIZE) {
    return false;
  }

  if (currentState === "CRITICAL") {
    return false;
  }

  const latestScore = history[history.length - 1].score;
  if (latestScore < TREND_PROXIMITY_FLOOR) {
    return false;
  }

  const slope = computeTrendSlope(history);
  return slope > TREND_SLOPE_THRESHOLD;
}