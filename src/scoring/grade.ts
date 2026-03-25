import type { HealthScores } from '../types.js';
import type { RawScores } from './calculator.js';

export function assignGrade(raw: RawScores): HealthScores {
  // Weighted composite: Security 35%, Resilience 25%, Comprehension 25%, Deps 15%
  const overall = Math.round(
    raw.security * 0.35 +
    raw.resilience * 0.25 +
    raw.comprehension * 0.25 +
    raw.dependencyHealth * 0.15
  );

  let grade: string;
  if (overall >= 85) grade = 'A';
  else if (overall >= 70) grade = 'B';
  else if (overall >= 55) grade = 'C';
  else if (overall >= 40) grade = 'D';
  else grade = 'F';

  return {
    comprehension: raw.comprehension,
    resilience: raw.resilience,
    security: raw.security,
    dependencyHealth: raw.dependencyHealth,
    overall,
    grade,
  };
}
