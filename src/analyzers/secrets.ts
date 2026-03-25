import type { SourceFile } from '../detect.js';
import type { AnalyzerResult, Finding } from '../types.js';

interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'warning';
}

const SECRET_PATTERNS: SecretPattern[] = [
  // API keys
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/, severity: 'critical' },
  { name: 'AWS Secret Key', pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}/, severity: 'critical' },
  { name: 'GitHub Token', pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/, severity: 'critical' },
  { name: 'Slack Token', pattern: /xox[bpors]-[0-9]{10,}-[a-zA-Z0-9-]+/, severity: 'critical' },
  { name: 'Stripe Key', pattern: /(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}/, severity: 'critical' },
  { name: 'OpenAI API Key', pattern: /sk-[A-Za-z0-9]{32,}/, severity: 'critical' },

  // Generic patterns
  { name: 'Private Key', pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/, severity: 'critical' },
  { name: 'Generic API Key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/, severity: 'warning' },
  { name: 'Generic Secret', pattern: /(?:secret|password|passwd|token)\s*[:=]\s*['"][^'"]{8,}['"]/, severity: 'warning' },
  { name: 'Bearer Token', pattern: /Bearer\s+[a-zA-Z0-9._~+/=-]{20,}/, severity: 'warning' },
  { name: 'Connection String', pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+:[^\s'"]+@/, severity: 'critical' },
  { name: 'JWT', pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, severity: 'warning' },
];

// Files/dirs to skip (test fixtures, lock files, etc.)
const SKIP_PATTERNS = [
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /\.mock\.[tj]sx?$/,
  /__tests__/,
  /__mocks__/,
  /fixtures?\//,
  /\.d\.ts$/,
  /lock\.json$/,
  /\.lock$/,
];

function isTestOrFixture(filePath: string): boolean {
  return SKIP_PATTERNS.some(p => p.test(filePath));
}

export function analyzeSecrets(files: SourceFile[]): AnalyzerResult {
  const findings: Finding[] = [];
  let secretCount = 0;

  for (const file of files) {
    if (isTestOrFixture(file.relativePath)) continue;

    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      // Skip lines that reference env vars (safe pattern)
      if (line.includes('process.env') || line.includes('import.meta.env')) continue;

      for (const sp of SECRET_PATTERNS) {
        if (sp.pattern.test(line)) {
          secretCount++;
          findings.push({
            analyzer: 'secrets',
            severity: sp.severity,
            file: file.relativePath,
            line: i + 1,
            message: `Possible ${sp.name} found in source code`,
            suggestion: 'Move to environment variables or a secrets manager',
          });
          break; // One finding per line
        }
      }
    }
  }

  return {
    name: 'secrets',
    findings,
    stats: {
      secretsFound: secretCount,
    },
  };
}
