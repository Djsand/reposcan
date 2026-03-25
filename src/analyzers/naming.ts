import type { SourceFile } from '../detect.js';
import type { AnalyzerResult, Finding } from '../types.js';

const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/;
const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;
const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;
const SCREAMING_SNAKE = /^[A-Z][A-Z0-9_]*$/;

type Convention = 'camelCase' | 'snake_case' | 'PascalCase' | 'SCREAMING_SNAKE' | 'mixed';

function detectConvention(name: string): Convention | null {
  if (SCREAMING_SNAKE.test(name) && name.includes('_')) return 'SCREAMING_SNAKE';
  if (PASCAL_CASE.test(name)) return 'PascalCase';
  if (CAMEL_CASE.test(name)) return 'camelCase';
  if (SNAKE_CASE.test(name) && name.includes('_')) return 'snake_case';
  return null;
}

// Extract identifiers from source using regex (fast, no AST needed for naming)
function extractIdentifiers(content: string): Array<{ name: string; line: number }> {
  const ids: Array<{ name: string; line: number }> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // function declarations
    const funcMatch = line.match(/(?:function\s+|const\s+|let\s+|var\s+)([a-zA-Z_$][\w$]*)/);
    if (funcMatch) {
      ids.push({ name: funcMatch[1], line: i + 1 });
    }

    // method definitions in classes/objects
    const methodMatch = line.match(/^\s+([a-zA-Z_$][\w$]*)\s*\(/);
    if (methodMatch && !['if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'import', 'export'].includes(methodMatch[1])) {
      ids.push({ name: methodMatch[1], line: i + 1 });
    }
  }

  return ids;
}

export function analyzeNaming(files: SourceFile[]): AnalyzerResult {
  const findings: Finding[] = [];
  let totalIds = 0;
  let inconsistentFiles = 0;

  for (const file of files) {
    const identifiers = extractIdentifiers(file.content);
    if (identifiers.length < 3) continue;

    totalIds += identifiers.length;

    // Count conventions used (exclude PascalCase for classes and SCREAMING_SNAKE for constants)
    const variableConventions: Record<string, number> = {};
    for (const id of identifiers) {
      const conv = detectConvention(id.name);
      if (conv && conv !== 'PascalCase' && conv !== 'SCREAMING_SNAKE') {
        variableConventions[conv] = (variableConventions[conv] || 0) + 1;
      }
    }

    const convKeys = Object.keys(variableConventions);
    if (convKeys.length > 1) {
      inconsistentFiles++;
      const dominant = convKeys.reduce((a, b) =>
        variableConventions[a] > variableConventions[b] ? a : b
      );

      // Find the minority-convention identifiers
      for (const id of identifiers) {
        const conv = detectConvention(id.name);
        if (conv && conv !== dominant && conv !== 'PascalCase' && conv !== 'SCREAMING_SNAKE') {
          findings.push({
            analyzer: 'naming',
            severity: 'info',
            file: file.relativePath,
            line: id.line,
            message: `"${id.name}" uses ${conv} but file predominantly uses ${dominant}`,
            suggestion: `Rename to match the ${dominant} convention used in this file`,
          });
        }
      }
    }
  }

  return {
    name: 'naming',
    findings,
    stats: {
      totalIdentifiers: totalIds,
      inconsistentFiles,
      filesAnalyzed: files.length,
    },
  };
}
