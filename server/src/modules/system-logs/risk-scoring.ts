import { ErrorLogSeverity } from "@prisma/client";

/**
 * Deterministic risk scoring for a detected attack.
 *
 * Scoring formula (documented here and in code):
 *
 *   score = base(severity) * confidenceMultiplier
 *         + min(repeatCount, 10) * 3          // repeated events from same IP
 *         + min(distinctPaths, 10) * 2        // breadth of targeted paths
 *         + min(distinctCategories, 8) * 4    // diversity of attack classes
 *         + min(priorBlockCount, 5) * 10      // previous blocks (escalation)
 *
 *   base:        INFO=5, LOW=10, MEDIUM=25, HIGH=50, CRITICAL=80
 *   multiplier:  HIGH=1.3, MEDIUM=1.0, LOW=0.7
 *
 * The final score is clamped to [0, 100]. Detection and blocking remain
 * separate: a score only informs a mitigation decision, it never blocks by
 * itself.
 */
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

const SEVERITY_BASE: Record<ErrorLogSeverity, number> = {
  INFO: 5,
  LOW: 10,
  MEDIUM: 25,
  HIGH: 50,
  CRITICAL: 80,
};

const CONFIDENCE_MULTIPLIER: Record<Confidence, number> = {
  HIGH: 1.3,
  MEDIUM: 1.0,
  LOW: 0.7,
};

export interface RiskContext {
  severity: ErrorLogSeverity;
  confidence: Confidence;
  attackType: string;
  repeatCount: number;
  distinctPaths: number;
  distinctCategories: number;
  priorBlockCount: number;
}

export function normalizeConfidence(value: string): Confidence {
  if (value === "HIGH" || value === "MEDIUM") {
    return value;
  }

  return "LOW";
}

export function computeRiskScore(context: RiskContext): number {
  const base = SEVERITY_BASE[context.severity] ?? SEVERITY_BASE.LOW;
  const multiplier = CONFIDENCE_MULTIPLIER[context.confidence] ?? 1;

  let score = base * multiplier;
  score += Math.min(context.repeatCount, 10) * 3;
  score += Math.min(context.distinctPaths, 10) * 2;
  score += Math.min(context.distinctCategories, 8) * 4;
  score += Math.min(context.priorBlockCount, 5) * 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}
