import type { Finding } from "./types";

const BASE_SCORE = 100;

export function computeScore(findings: Finding[]): number {
  const totalImpact = findings.reduce((sum, finding) => sum + finding.scoreImpact, 0);
  const score = BASE_SCORE + totalImpact;
  return Math.max(0, Math.min(100, score));
}
