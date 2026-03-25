import chalk from 'chalk';
import Table from 'cli-table3';
import type { ExplodeReport, TimeBomb, HealthScores } from '../types.js';

const GRADE_ART: Record<string, string[]> = {
  A: [
    '   █████╗ ',
    '  ██╔══██╗',
    '  ███████║',
    '  ██╔══██║',
    '  ██║  ██║',
    '  ╚═╝  ╚═╝',
  ],
  B: [
    '  ██████╗ ',
    '  ██╔══██╗',
    '  ██████╔╝',
    '  ██╔══██╗',
    '  ██████╔╝',
    '  ╚═════╝ ',
  ],
  C: [
    '   ██████╗',
    '  ██╔════╝',
    '  ██║     ',
    '  ██║     ',
    '   ██████╗',
    '   ╚═════╝',
  ],
  D: [
    '  ██████╗ ',
    '  ██╔══██╗',
    '  ██║  ██║',
    '  ██║  ██║',
    '  ██████╔╝',
    '  ╚═════╝ ',
  ],
  F: [
    '  ███████╗',
    '  ██╔════╝',
    '  █████╗  ',
    '  ██╔══╝  ',
    '  ██║     ',
    '  ╚═╝     ',
  ],
};

function gradeColor(grade: string): typeof chalk {
  switch (grade) {
    case 'A': return chalk.green;
    case 'B': return chalk.greenBright;
    case 'C': return chalk.yellow;
    case 'D': return chalk.rgb(255, 165, 0); // orange
    case 'F': return chalk.red;
    default: return chalk.white;
  }
}

function scoreColor(score: number): typeof chalk {
  if (score >= 85) return chalk.green;
  if (score >= 70) return chalk.greenBright;
  if (score >= 55) return chalk.yellow;
  if (score >= 40) return chalk.rgb(255, 165, 0);
  return chalk.red;
}

function scoreBar(score: number, width = 30): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = scoreColor(score);
  return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty)) + ` ${score}`;
}

function severityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return chalk.red('●');
    case 'warning': return chalk.yellow('●');
    case 'info': return chalk.blue('●');
    default: return '○';
  }
}

function timeBombTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'hallucinated-import': '👻 Phantom Import',
    'orphaned-code': '💀 Dead Code',
    'copy-paste-drift': '📋 Copy-Paste',
    'naming-inconsistency': '🏷️  Naming',
    'unhandled-edge-case': '⚡ Complexity',
    'hardcoded-secret': '🔑 Secret',
    'circular-dependency': '🔄 Circular Dep',
  };
  return labels[type] || type;
}

export function renderTerminalReport(report: ExplodeReport): void {
  const { scores, timeBombs, arch, repoName, mode, duration } = report;
  const color = gradeColor(scores.grade);

  // Header
  console.log(chalk.dim('  ─'.repeat(30)));
  console.log();

  // Grade ASCII art
  const art = GRADE_ART[scores.grade] || GRADE_ART['F'];
  for (const line of art) {
    console.log(color(line));
  }
  console.log();
  console.log(`  ${chalk.bold(repoName)} — Overall Health: ${color.bold(scores.grade)} (${scores.overall}/100)`);
  console.log(`  ${chalk.dim(`${mode === 'ai-enhanced' ? '🤖 AI-Enhanced' : '⚡ Static'} Analysis · ${arch.totalFiles} files · ${arch.totalLines.toLocaleString()} lines · ${(duration / 1000).toFixed(1)}s`)}`);
  console.log();

  // Score bars
  console.log(chalk.dim('  ─'.repeat(30)));
  console.log(chalk.bold('  VITAL SIGNS'));
  console.log();
  console.log(`  Security        ${scoreBar(scores.security)}`);
  console.log(`  Resilience      ${scoreBar(scores.resilience)}`);
  console.log(`  Comprehension   ${scoreBar(scores.comprehension)}`);
  console.log(`  Dependencies    ${scoreBar(scores.dependencyHealth)}`);
  console.log();

  // Time Bombs
  if (timeBombs.length > 0) {
    console.log(chalk.dim('  ─'.repeat(30)));
    console.log(chalk.bold(`  💣 TIME BOMBS (${timeBombs.length} found)`));
    console.log();

    const table = new Table({
      chars: {
        'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
        'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
        'left': '  ', 'left-mid': '', 'mid': '', 'mid-mid': '',
        'right': '', 'right-mid': '', 'middle': ' ',
      },
      style: { 'padding-left': 1, 'padding-right': 1 },
      colWidths: [4, 20, 50, null],
      wordWrap: true,
    });

    // Show top 15 time bombs
    const shown = timeBombs.slice(0, 15);
    for (const tb of shown) {
      const location = tb.line ? `${tb.file}:${tb.line}` : tb.file;
      table.push([
        severityIcon(tb.severity),
        timeBombTypeLabel(tb.type),
        tb.description,
        chalk.dim(location),
      ]);
    }

    console.log(table.toString());

    if (timeBombs.length > 15) {
      console.log(chalk.dim(`\n  ... and ${timeBombs.length - 15} more. Use --html report.html for the full list.`));
    }
    console.log();
  } else {
    console.log(chalk.dim('  ─'.repeat(30)));
    console.log(chalk.green('  ✅ No time bombs detected!'));
    console.log();
  }

  // Languages
  console.log(chalk.dim('  ─'.repeat(30)));
  console.log(chalk.bold('  LANGUAGES'));
  console.log();
  const sortedLangs = Object.entries(arch.languages).sort((a, b) => b[1] - a[1]);
  for (const [lang, lines] of sortedLangs) {
    const pct = Math.round((lines / arch.totalLines) * 100);
    console.log(`  ${lang.padEnd(15)} ${chalk.dim(lines.toLocaleString().padStart(8) + ' lines')} (${pct}%)`);
  }
  console.log();

  // Footer
  console.log(chalk.dim('  ─'.repeat(30)));
  console.log(chalk.dim('  reposcan v0.1.0 — The Codebase Doctor'));
  console.log(chalk.dim('  https://github.com/nicolai/reposcan'));
  console.log();
}
