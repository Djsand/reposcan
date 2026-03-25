import { Command } from 'commander';
import type { ExplodeOptions } from './types.js';

export function parseArgs(argv: string[]): ExplodeOptions {
  const program = new Command();

  program
    .name('reposcan')
    .description('The Codebase Doctor — scan any repo and get a full health report')
    .version('0.1.0')
    .argument('<target>', 'GitHub URL or local path to analyze')
    .option('--fix', 'auto-fix issues on a new branch (local paths only)', false)
    .option('--html <path>', 'generate an HTML report at the given path')
    .option('--badge', 'output a shields.io badge URL', false)
    .option('--budget <tokens>', 'max token budget for AI analysis', '100000')
    .option('--verbose', 'show detailed analysis output', false);

  program.parse(argv);

  const opts = program.opts();
  const target = program.args[0];

  return {
    input: target,
    fix: opts.fix,
    html: opts.html,
    badge: opts.badge,
    budget: parseInt(opts.budget, 10),
    verbose: opts.verbose,
  };
}
