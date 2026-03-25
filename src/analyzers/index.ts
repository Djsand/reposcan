import type { SourceFile } from '../detect.js';
import type { AnalyzerResult } from '../types.js';
import { analyzeNaming } from './naming.js';
import { analyzeComplexity } from './complexity.js';
import { analyzeDeadCode } from './dead-code.js';
import { analyzeImports } from './imports.js';
import { analyzeSecrets } from './secrets.js';
import { analyzeDuplicates } from './duplicates.js';
import { analyzeDependencies } from './dependencies.js';

export async function runAllAnalyzers(files: SourceFile[], repoPath: string): Promise<AnalyzerResult[]> {
  const results: AnalyzerResult[] = [];

  // Run all analyzers
  results.push(analyzeNaming(files));
  results.push(analyzeComplexity(files));
  results.push(analyzeDeadCode(files));
  results.push(await analyzeImports(files, repoPath));
  results.push(analyzeSecrets(files));
  results.push(analyzeDuplicates(files));
  results.push(analyzeDependencies(repoPath));

  return results;
}
