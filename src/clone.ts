import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const GITHUB_URL_RE = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/;

export interface RepoInput {
  path: string;
  isClone: boolean;
  repoName: string;
  cleanup: () => void;
}

export function resolveInput(input: string): RepoInput {
  if (GITHUB_URL_RE.test(input)) {
    return cloneRepo(input);
  }

  const localPath = resolve(input);
  if (!existsSync(localPath)) {
    throw new Error(`Path does not exist: ${localPath}`);
  }

  const repoName = localPath.split('/').pop() || 'unknown';
  return {
    path: localPath,
    isClone: false,
    repoName,
    cleanup: () => {},
  };
}

function cloneRepo(url: string): RepoInput {
  const cleanUrl = url.replace(/\/$/, '').replace(/\.git$/, '');
  const parts = cleanUrl.split('/');
  const repoName = parts[parts.length - 1] || 'repo';

  const tempDir = mkdtempSync(join(tmpdir(), 'github-explode-'));
  const clonePath = join(tempDir, repoName);

  try {
    execSync(`git clone --depth 1 "${cleanUrl}.git" "${clonePath}"`, {
      stdio: 'pipe',
      timeout: 120_000,
    });
  } catch {
    try {
      execSync(`git clone --depth 1 "${cleanUrl}" "${clonePath}"`, {
        stdio: 'pipe',
        timeout: 120_000,
      });
    } catch (err) {
      rmSync(tempDir, { recursive: true, force: true });
      throw new Error(`Failed to clone ${url}: ${(err as Error).message}`);
    }
  }

  return {
    path: clonePath,
    isClone: true,
    repoName,
    cleanup: () => {
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}
