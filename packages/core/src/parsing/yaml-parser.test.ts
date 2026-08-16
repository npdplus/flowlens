import { describe, expect, it } from 'vitest';

import { parseYaml } from '../index';

describe('parseYaml', () => {
  it('parses a valid YAML mapping as untrusted data', () => {
    expect(parseYaml('name: Flow\nenabled: true\n')).toEqual({
      success: true,
      format: 'yaml',
      data: { name: 'Flow', enabled: true },
    });
  });

  it('parses a minimal workflow-shaped YAML value without claiming validity', () => {
    const result = parseYaml('schemaVersion: "0.1"\nname: Minimal\nsteps: []\ntransitions: []\n');

    expect(result.success).toBe(true);
  });

  it('returns FL1002 and reliable source location for invalid YAML syntax', () => {
    const result = parseYaml('steps:\n  - id: [broken\n');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('FL1002');
      expect(result.format).toBe('yaml');
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.location?.line).toBeGreaterThanOrEqual(1);
      expect(result.location?.column).toBeGreaterThanOrEqual(1);
    }
  });

  it('returns FL1002 for empty input', () => {
    const result = parseYaml('');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('FL1002');
      expect(result.format).toBe('yaml');
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('allows a YAML scalar to remain untrusted', () => {
    expect(parseYaml('hello')).toEqual({ success: true, format: 'yaml', data: 'hello' });
  });

  it('allows a YAML sequence to remain untrusted', () => {
    expect(parseYaml('- one\n- two\n')).toEqual({
      success: true,
      format: 'yaml',
      data: ['one', 'two'],
    });
  });

  it('preserves nested metadata values', () => {
    const result = parseYaml(
      'metadata:\n  owner: platform\n  config:\n    retries: 2\n    flags:\n      - true\n      - null\n',
    );

    expect(result).toEqual({
      success: true,
      format: 'yaml',
      data: {
        metadata: {
          owner: 'platform',
          config: { retries: 2, flags: [true, null] },
        },
      },
    });
  });

  it('preserves safe multi-line strings as data', () => {
    const result = parseYaml('description: |\n  first line\n  second line\n');

    expect(result).toEqual({
      success: true,
      format: 'yaml',
      data: { description: 'first line\nsecond line\n' },
    });
  });

  it('keeps script-like text inert', () => {
    const script = '<script>globalThis.compromised=true</script>';
    const result = parseYaml(`label: "${script}"\n`);

    expect(result).toEqual({ success: true, format: 'yaml', data: { label: script } });
    expect((globalThis as { compromised?: boolean }).compromised).toBeUndefined();
  });

  it('keeps condition strings inert', () => {
    const result = parseYaml('condition: "approved && dangerousCall()"\n');

    expect(result).toEqual({
      success: true,
      format: 'yaml',
      data: { condition: 'approved && dangerousCall()' },
    });
  });

  it('does not enable unsafe custom executable YAML tags', () => {
    const result = parseYaml('payload: !!js/function "function () { return 1; }"\n');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('FL1002');
    }
  });
});
