import { describe, expect, it } from 'vitest';

import {
  FLOWLENS_THEME_KEY,
  initialThemePreference,
  inputFormatFromFileName,
  persistThemePreference,
  readWorkflowFile,
} from './app-utils';

describe('P08 browser utilities', () => {
  it('maps only supported local workflow extensions deterministically', () => {
    expect(inputFormatFromFileName('flow.JSON')).toBe('json');
    expect(inputFormatFromFileName('flow.yaml')).toBe('yaml');
    expect(inputFormatFromFileName('flow.YML')).toBe('yaml');
    expect(inputFormatFromFileName('flow.txt')).toBeNull();
  });

  it('reads only an explicitly supplied supported file', async () => {
    let readCount = 0;
    const result = await readWorkflowFile({
      name: 'local.yaml',
      async text() {
        readCount += 1;
        return 'schemaVersion: "0.1"';
      },
    });

    expect(result).toEqual({ ok: true, format: 'yaml', text: 'schemaVersion: "0.1"' });
    expect(readCount).toBe(1);
  });

  it('rejects unsupported files without reading their content', async () => {
    let readCount = 0;
    const result = await readWorkflowFile({
      name: 'workflow.exe',
      async text() {
        readCount += 1;
        return 'should not be read';
      },
    });

    expect(result.ok).toBe(false);
    expect(readCount).toBe(0);
  });

  it('falls back safely when browser preference storage is unavailable', () => {
    expect(initialThemePreference()).toBe('light');
    expect(() => persistThemePreference('dark')).not.toThrow();
    expect(FLOWLENS_THEME_KEY).toBe('flowlens.theme');
  });
});
