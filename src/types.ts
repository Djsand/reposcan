export type Severity = 'critical' | 'warning' | 'info';

export interface Finding {
  analyzer: string;
  severity: Severity;
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export interface AnalyzerResult {
  name: string;
  findings: Finding[];
  stats: Record<string, number>;
}

export interface HealthScores {
  comprehension: number;
  resilience: number;
  security: number;
  dependencyHealth: number;
  overall: number;
  grade: string;
}

export interface TimeBomb {
  type: 'hallucinated-import' | 'orphaned-code' | 'copy-paste-drift' | 'naming-inconsistency' | 'unhandled-edge-case' | 'hardcoded-secret' | 'circular-dependency';
  severity: Severity;
  file: string;
  line?: number;
  description: string;
  suggestion?: string;
}

export interface ArchInfo {
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  entryPoints: string[];
}

export interface ScanReport {
  repoName: string;
  repoPath: string;
  analyzedAt: string;
  mode: 'static' | 'ai-enhanced';
  arch: ArchInfo;
  scores: HealthScores;
  timeBombs: TimeBomb[];
  findings: Finding[];
  duration: number;
}

export interface ScanOptions {
  input: string;
  fix: boolean;
  html?: string;
  badge: boolean;
  budget: number;
  verbose: boolean;
}
