import type { AnalyzerResult } from '../types.js';

export interface RawScores {
  comprehension: number;
  resilience: number;
  security: number;
  dependencyHealth: number;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.round(Math.max(min, Math.min(max, value)));
}

function getStats(results: AnalyzerResult[], analyzerName: string): Record<string, number> {
  return results.find(r => r.name === analyzerName)?.stats ?? {};
}

function countFindings(results: AnalyzerResult[], analyzerName: string, severity?: string): number {
  const result = results.find(r => r.name === analyzerName);
  if (!result) return 0;
  if (!severity) return result.findings.length;
  return result.findings.filter(f => f.severity === severity).length;
}

export function calculateScores(results: AnalyzerResult[], totalFiles: number, totalLines: number): RawScores {
  // === COMPREHENSION SCORE ===
  // Based on: naming consistency, complexity, file/function lengths
  const namingStats = getStats(results, 'naming');
  const complexityStats = getStats(results, 'complexity');

  // Naming: ratio of consistent files
  const namingScore = namingStats.filesAnalyzed > 0
    ? 100 * (1 - (namingStats.inconsistentFiles || 0) / namingStats.filesAnalyzed)
    : 100;

  // Complexity: penalize high complexity and long functions
  const funcCount = complexityStats.totalFunctions || 1;
  const complexityPenalty = ((complexityStats.highComplexityCount || 0) / funcCount) * 200;
  const nestingPenalty = ((complexityStats.deepNestingCount || 0) / funcCount) * 150;
  const longFuncPenalty = ((complexityStats.longFunctionCount || 0) / funcCount) * 100;
  const longFilePenalty = ((complexityStats.longFileCount || 0) / Math.max(totalFiles, 1)) * 100;

  const complexityScore = 100 - complexityPenalty - nestingPenalty - longFuncPenalty - longFilePenalty;

  // Abstraction quality (file size distribution)
  const abstractionScore = 100 - longFilePenalty;

  const comprehension = clamp(
    namingScore * 0.3 + complexityScore * 0.4 + abstractionScore * 0.3
  );

  // === RESILIENCE SCORE ===
  // Based on: dead code, error handling patterns
  const deadCodeStats = getStats(results, 'dead-code');
  const duplicateStats = getStats(results, 'duplicates');

  const unusedRatio = deadCodeStats.totalExports > 0
    ? (deadCodeStats.unusedExports || 0) / deadCodeStats.totalExports
    : 0;
  const deadCodePenalty = unusedRatio * 150;

  const duplicatePenalty = duplicateStats.totalBlocks > 0
    ? ((duplicateStats.duplicateBlocks || 0) / duplicateStats.totalBlocks) * 200
    : 0;

  const resilience = clamp(100 - deadCodePenalty - duplicatePenalty);

  // === SECURITY SCORE ===
  const secretsFound = countFindings(results, 'secrets');
  const criticalSecrets = countFindings(results, 'secrets', 'critical');
  const importCriticals = countFindings(results, 'imports', 'critical');

  // Each critical secret is a big penalty
  const secretPenalty = criticalSecrets * 20 + (secretsFound - criticalSecrets) * 5;
  const importPenalty = importCriticals * 10;

  const security = clamp(100 - secretPenalty - importPenalty);

  // === DEPENDENCY HEALTH ===
  const depStats = getStats(results, 'dependencies');
  const depFindings = countFindings(results, 'dependencies');
  const depCriticals = countFindings(results, 'dependencies', 'critical');

  const depPenalty = depCriticals * 25 + (depFindings - depCriticals) * 10 + (depStats.lockDrift || 0) * 15;

  const dependencyHealth = clamp(100 - depPenalty);

  return { comprehension, resilience, security, dependencyHealth };
}
