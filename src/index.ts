#!/usr/bin/env node

import { parseArgs } from './cli.js';
import { resolveInput } from './clone.js';
import { discoverFiles, summarizeLanguages } from './detect.js';
import { runAllAnalyzers } from './analyzers/index.js';
import { calculateScores } from './scoring/calculator.js';
import { assignGrade } from './scoring/grade.js';
import { extractTimeBombs } from './scoring/time-bombs.js';
import { renderTerminalReport } from './reporters/terminal.js';
import { generateHtmlReport } from './reporters/html.js';
import { generateBadge } from './reporters/badge.js';
import { runAiAnalysis } from './ai/client.js';
import type { ExplodeReport, ArchInfo } from './types.js';

async function main() {
  const startTime = Date.now();
  const options = parseArgs(process.argv);

  console.log();
  console.log('  🔬 github-explode — The Codebase Doctor');
  console.log();

  // Resolve input (clone or local)
  console.log(`  📂 Resolving ${options.input}...`);
  let repo;
  try {
    repo = resolveInput(options.input);
  } catch (err) {
    console.error(`  ❌ ${(err as Error).message}`);
    process.exit(1);
  }

  try {
    // Discover files
    console.log(`  🔍 Scanning files...`);
    const files = discoverFiles(repo.path);

    if (files.length === 0) {
      console.error('  ❌ No supported source files found (TypeScript/JavaScript)');
      process.exit(1);
    }

    const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
    const languages = summarizeLanguages(files);
    console.log(`  📊 Found ${files.length} files (${totalLines.toLocaleString()} lines)`);

    // Run static analysis
    console.log(`  ⚡ Running static analysis...`);
    const analyzerResults = await runAllAnalyzers(files, repo.path);

    // Run AI analysis (if API key available)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    let aiFindings = { findings: [], timeBombs: [] } as Awaited<ReturnType<typeof runAiAnalysis>>;
    let mode: 'static' | 'ai-enhanced' = 'static';

    if (apiKey) {
      console.log(`  🤖 Running AI analysis (Claude)...`);
      try {
        aiFindings = await runAiAnalysis(files, analyzerResults, apiKey, options.budget);
        mode = 'ai-enhanced';
      } catch (err) {
        console.log(`  ⚠️  AI analysis failed, continuing with static-only: ${(err as Error).message}`);
      }
    } else {
      console.log(`  ℹ️  No ANTHROPIC_API_KEY set — running static analysis only`);
      console.log(`     Set ANTHROPIC_API_KEY for deeper AI-powered analysis`);
    }

    // Combine findings
    const allFindings = [
      ...analyzerResults.flatMap(r => r.findings),
      ...aiFindings.findings,
    ];

    // Extract time bombs
    const timeBombs = [
      ...extractTimeBombs(analyzerResults),
      ...aiFindings.timeBombs,
    ];

    // Calculate scores
    const rawScores = calculateScores(analyzerResults, files.length, totalLines);
    const scores = assignGrade(rawScores);

    // Build report
    const arch: ArchInfo = {
      totalFiles: files.length,
      totalLines,
      languages,
      entryPoints: findEntryPoints(files.map(f => f.relativePath)),
    };

    const report: ExplodeReport = {
      repoName: repo.repoName,
      repoPath: repo.path,
      analyzedAt: new Date().toISOString(),
      mode,
      arch,
      scores,
      timeBombs,
      findings: allFindings,
      duration: Date.now() - startTime,
    };

    // Output
    console.log();
    renderTerminalReport(report);

    if (options.html) {
      generateHtmlReport(report, options.html);
      console.log(`\n  📄 HTML report saved to ${options.html}`);
    }

    if (options.badge) {
      const badge = generateBadge(report.scores.grade);
      console.log(`\n  🏷️  Badge: ${badge}`);
    }
  } finally {
    repo.cleanup();
  }
}

function findEntryPoints(relativePaths: string[]): string[] {
  const entryPatterns = [
    /^src\/index\.[tj]sx?$/,
    /^src\/main\.[tj]sx?$/,
    /^src\/app\.[tj]sx?$/,
    /^index\.[tj]sx?$/,
    /^main\.[tj]sx?$/,
    /^app\.[tj]sx?$/,
  ];

  return relativePaths.filter(p =>
    entryPatterns.some(pattern => pattern.test(p))
  );
}

main().catch(err => {
  console.error(`\n  ❌ Fatal error: ${err.message}`);
  process.exit(1);
});
