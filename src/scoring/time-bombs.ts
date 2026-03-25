import type { AnalyzerResult, TimeBomb } from '../types.js';

export function extractTimeBombs(results: AnalyzerResult[]): TimeBomb[] {
  const timeBombs: TimeBomb[] = [];

  for (const result of results) {
    for (const finding of result.findings) {
      // Only promote critical/warning findings to time bombs
      if (finding.severity === 'info') continue;

      const type = mapToTimeBombType(result.name, finding.message);
      if (!type) continue;

      timeBombs.push({
        type,
        severity: finding.severity,
        file: finding.file,
        line: finding.line,
        description: finding.message,
        suggestion: finding.suggestion,
      });
    }
  }

  // Sort: critical first, then warning
  timeBombs.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return timeBombs;
}

function mapToTimeBombType(analyzerName: string, message: string): TimeBomb['type'] | null {
  switch (analyzerName) {
    case 'imports':
      if (message.includes('Phantom')) return 'hallucinated-import';
      if (message.includes('Broken')) return 'hallucinated-import';
      return null;
    case 'dead-code':
      return 'orphaned-code';
    case 'duplicates':
      return 'copy-paste-drift';
    case 'naming':
      return 'naming-inconsistency';
    case 'secrets':
      return 'hardcoded-secret';
    case 'complexity':
      if (message.includes('complexity')) return 'unhandled-edge-case';
      return null;
    default:
      return null;
  }
}
