import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const coreSourceRoot = dirname(fileURLToPath(import.meta.url));

async function collectProductionSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectProductionSourceFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(path);
    }
  }

  return files;
}

describe('@flowlens/core architecture boundary', () => {
  it('does not import React or React Flow from production source', async () => {
    const sourceFiles = await collectProductionSourceFiles(coreSourceRoot);
    const forbiddenImport =
      /from\s+['"](?:react|react-dom|reactflow|@xyflow\/react)(?:\/[^'"]*)?['"]/;

    expect(sourceFiles.length).toBeGreaterThan(0);

    for (const sourceFile of sourceFiles) {
      const source = await readFile(sourceFile, 'utf8');
      expect(source, sourceFile).not.toMatch(forbiddenImport);
    }
  });
});
