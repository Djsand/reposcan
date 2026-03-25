import Anthropic from '@anthropic-ai/sdk';
import type { SourceFile } from '../detect.js';
import type { AnalyzerResult, Finding, TimeBomb } from '../types.js';

interface AiAnalysisResult {
  findings: Finding[];
  timeBombs: TimeBomb[];
}

export async function runAiAnalysis(
  files: SourceFile[],
  staticResults: AnalyzerResult[],
  apiKey: string,
  tokenBudget: number
): Promise<AiAnalysisResult> {
  const client = new Anthropic({ apiKey });

  // Prepare a summary of the codebase for the AI
  const fileSummaries = files
    .slice(0, 50) // Limit to 50 most important files
    .map(f => {
      // Truncate large files
      const content = f.content.length > 3000
        ? f.content.slice(0, 3000) + '\n// ... (truncated)'
        : f.content;
      return `--- ${f.relativePath} (${f.lines} lines) ---\n${content}`;
    })
    .join('\n\n');

  // Summarize static findings
  const staticSummary = staticResults.map(r =>
    `${r.name}: ${r.findings.length} findings (${r.findings.filter(f => f.severity === 'critical').length} critical)`
  ).join('\n');

  const prompt = `You are a senior code reviewer analyzing a codebase for quality, security, and maintainability issues.

Here are the static analysis results so far:
${staticSummary}

Now analyze the following source code for deeper issues that static analysis misses:

${fileSummaries}

Find issues in these categories:
1. **Logic errors**: Functions that have subtle bugs, incorrect edge case handling, race conditions
2. **Security vulnerabilities**: Beyond pattern matching — actual security risks in the logic
3. **Architectural problems**: Tight coupling, god objects, circular dependencies in design
4. **API misuse**: Incorrect use of libraries, deprecated patterns, anti-patterns
5. **Comprehension debt**: Code that works but is unnecessarily hard to understand

For each issue found, respond in this EXACT JSON format (no markdown, just JSON):
{
  "findings": [
    {
      "severity": "critical|warning",
      "file": "relative/path.ts",
      "line": 42,
      "message": "Clear description of the issue",
      "suggestion": "How to fix it"
    }
  ],
  "timeBombs": [
    {
      "type": "unhandled-edge-case|circular-dependency",
      "severity": "critical|warning",
      "file": "relative/path.ts",
      "line": 42,
      "description": "Why this is a ticking time bomb",
      "suggestion": "How to defuse it"
    }
  ]
}

Be specific and actionable. Only report real issues you're confident about. Do NOT report style issues or minor nitpicks — focus on things that could cause production failures.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: Math.min(tokenBudget, 4096),
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('');

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { findings: [], timeBombs: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const findings: Finding[] = (parsed.findings || []).map((f: Record<string, unknown>) => ({
      analyzer: 'ai',
      severity: f.severity as string,
      file: f.file as string,
      line: f.line as number,
      message: f.message as string,
      suggestion: f.suggestion as string,
    }));

    const timeBombs: TimeBomb[] = (parsed.timeBombs || []).map((tb: Record<string, unknown>) => ({
      type: tb.type as TimeBomb['type'],
      severity: tb.severity as TimeBomb['severity'],
      file: tb.file as string,
      line: tb.line as number,
      description: tb.description as string,
      suggestion: tb.suggestion as string,
    }));

    return { findings, timeBombs };
  } catch (err) {
    throw new Error(`AI analysis failed: ${(err as Error).message}`);
  }
}
