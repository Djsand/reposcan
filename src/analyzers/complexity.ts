import type { SourceFile } from '../detect.js';
import type { AnalyzerResult, Finding } from '../types.js';

interface FunctionInfo {
  name: string;
  line: number;
  complexity: number;
  length: number;
  nestingDepth: number;
}

function analyzeFunctions(content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const lines = content.split('\n');

  // Track brace depth to find function boundaries
  let currentFunc: { name: string; startLine: number; braceDepth: number; maxNesting: number; branches: number } | null = null;
  let globalBraceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect function starts
    const funcPatterns = [
      /(?:function\s+)([a-zA-Z_$][\w$]*)\s*\(/,
      /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>/,
      /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s+)?function/,
      /^\s+(?:async\s+)?([a-zA-Z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*\S+)?\s*\{/,
    ];

    if (!currentFunc) {
      for (const pattern of funcPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          currentFunc = {
            name: match[1],
            startLine: i + 1,
            braceDepth: globalBraceDepth,
            maxNesting: 0,
            branches: 1,
          };
          break;
        }
      }
    }

    // Count braces
    for (const ch of line) {
      if (ch === '{') {
        globalBraceDepth++;
        if (currentFunc) {
          const relativeDepth = globalBraceDepth - currentFunc.braceDepth - 1;
          currentFunc.maxNesting = Math.max(currentFunc.maxNesting, relativeDepth);
        }
      } else if (ch === '}') {
        globalBraceDepth--;
        if (currentFunc && globalBraceDepth <= currentFunc.braceDepth) {
          functions.push({
            name: currentFunc.name,
            line: currentFunc.startLine,
            complexity: currentFunc.branches,
            length: i + 1 - currentFunc.startLine,
            nestingDepth: currentFunc.maxNesting,
          });
          currentFunc = null;
        }
      }
    }

    // Count branch points for cyclomatic complexity
    if (currentFunc) {
      const branchPatterns = /\b(if|else\s+if|for|while|do|switch|case|\?\?|&&|\|\||catch)\b|\?[^?:]/g;
      const matches = trimmed.match(branchPatterns);
      if (matches) {
        currentFunc.branches += matches.length;
      }
    }
  }

  return functions;
}

export function analyzeComplexity(files: SourceFile[]): AnalyzerResult {
  const findings: Finding[] = [];
  let totalFunctions = 0;
  let highComplexityCount = 0;
  let deepNestingCount = 0;
  let longFunctionCount = 0;
  let longFileCount = 0;

  for (const file of files) {
    // File-level: flag very long files
    if (file.lines > 500) {
      longFileCount++;
      findings.push({
        analyzer: 'complexity',
        severity: file.lines > 1000 ? 'warning' : 'info',
        file: file.relativePath,
        message: `File is ${file.lines} lines long`,
        suggestion: 'Consider splitting into smaller, focused modules',
      });
    }

    const functions = analyzeFunctions(file.content);
    totalFunctions += functions.length;

    for (const func of functions) {
      // High cyclomatic complexity
      if (func.complexity > 15) {
        highComplexityCount++;
        findings.push({
          analyzer: 'complexity',
          severity: func.complexity > 25 ? 'critical' : 'warning',
          file: file.relativePath,
          line: func.line,
          message: `Function "${func.name}" has cyclomatic complexity of ${func.complexity}`,
          suggestion: 'Break this function into smaller, single-purpose functions',
        });
      }

      // Deep nesting
      if (func.nestingDepth > 4) {
        deepNestingCount++;
        findings.push({
          analyzer: 'complexity',
          severity: func.nestingDepth > 6 ? 'warning' : 'info',
          file: file.relativePath,
          line: func.line,
          message: `Function "${func.name}" has nesting depth of ${func.nestingDepth}`,
          suggestion: 'Use early returns, guard clauses, or extract nested logic',
        });
      }

      // Long functions
      if (func.length > 100) {
        longFunctionCount++;
        findings.push({
          analyzer: 'complexity',
          severity: func.length > 200 ? 'warning' : 'info',
          file: file.relativePath,
          line: func.line,
          message: `Function "${func.name}" is ${func.length} lines long`,
          suggestion: 'Extract logical sections into separate functions',
        });
      }
    }
  }

  return {
    name: 'complexity',
    findings,
    stats: {
      totalFunctions,
      highComplexityCount,
      deepNestingCount,
      longFunctionCount,
      longFileCount,
    },
  };
}
