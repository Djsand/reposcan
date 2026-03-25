import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type { AnalyzerResult, Finding } from '../types.js';

export function analyzeDependencies(repoPath: string): AnalyzerResult {
  const findings: Finding[] = [];
  let outdatedCount = 0;
  let vulnCount = 0;
  let lockDrift = false;

  const pkgPath = join(repoPath, 'package.json');
  if (!existsSync(pkgPath)) {
    return {
      name: 'dependencies',
      findings: [{
        analyzer: 'dependencies',
        severity: 'warning',
        file: 'package.json',
        message: 'No package.json found',
      }],
      stats: { outdatedCount: 0, vulnCount: 0, lockDrift: 0 },
    };
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    return {
      name: 'dependencies',
      findings: [{
        analyzer: 'dependencies',
        severity: 'warning',
        file: 'package.json',
        message: 'Failed to parse package.json',
      }],
      stats: { outdatedCount: 0, vulnCount: 0, lockDrift: 0 },
    };
  }

  // Check lock file exists
  const hasLockFile = existsSync(join(repoPath, 'package-lock.json')) ||
                      existsSync(join(repoPath, 'yarn.lock')) ||
                      existsSync(join(repoPath, 'pnpm-lock.yaml')) ||
                      existsSync(join(repoPath, 'bun.lockb'));

  if (!hasLockFile) {
    lockDrift = true;
    findings.push({
      analyzer: 'dependencies',
      severity: 'warning',
      file: 'package.json',
      message: 'No lock file found (package-lock.json, yarn.lock, pnpm-lock.yaml)',
      suggestion: 'Add a lock file to ensure reproducible installs',
    });
  }

  // Check for wildcard / very loose version ranges
  const allDeps: Record<string, string> = {
    ...(pkg.dependencies as Record<string, string> || {}),
    ...(pkg.devDependencies as Record<string, string> || {}),
  };

  for (const [name, version] of Object.entries(allDeps)) {
    if (version === '*' || version === 'latest') {
      outdatedCount++;
      findings.push({
        analyzer: 'dependencies',
        severity: 'warning',
        file: 'package.json',
        message: `Dependency "${name}" uses wildcard version "${version}"`,
        suggestion: 'Pin to a specific version range',
      });
    }
  }

  // Try npm audit (if npm is available and node_modules exists)
  if (existsSync(join(repoPath, 'node_modules'))) {
    try {
      const auditOutput = execSync('npm audit --json 2>/dev/null', {
        cwd: repoPath,
        timeout: 30_000,
        encoding: 'utf-8',
      });
      const audit = JSON.parse(auditOutput);
      if (audit.metadata?.vulnerabilities) {
        const vuln = audit.metadata.vulnerabilities;
        vulnCount = (vuln.critical || 0) + (vuln.high || 0) + (vuln.moderate || 0);

        if (vuln.critical > 0) {
          findings.push({
            analyzer: 'dependencies',
            severity: 'critical',
            file: 'package.json',
            message: `${vuln.critical} critical vulnerabilities in dependencies`,
            suggestion: 'Run npm audit fix or update affected packages',
          });
        }
        if (vuln.high > 0) {
          findings.push({
            analyzer: 'dependencies',
            severity: 'warning',
            file: 'package.json',
            message: `${vuln.high} high-severity vulnerabilities in dependencies`,
            suggestion: 'Run npm audit fix or update affected packages',
          });
        }
      }
    } catch {
      // npm audit not available or failed — skip
    }
  }

  return {
    name: 'dependencies',
    findings,
    stats: {
      outdatedCount,
      vulnCount,
      lockDrift: lockDrift ? 1 : 0,
      totalDeps: Object.keys(allDeps).length,
    },
  };
}
