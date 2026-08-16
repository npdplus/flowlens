import { describe, expect, expectTypeOf, it } from 'vitest';

import { parseJson, type ParseSuccess } from '../index';

describe('parseJson', () => {
  it('parses a valid JSON object as untrusted data', () => {
    const result = parseJson('{"name":"Flow"}');

    expect(result).toEqual({
      success: true,
      format: 'json',
      data: { name: 'Flow' },
    });
    expectTypeOf<ParseSuccess['data']>().toEqualTypeOf<unknown>();
  });

  it('parses a minimal workflow-shaped JSON value without claiming validity', () => {
    const result = parseJson(
      '{"schemaVersion":"0.1","name":"Minimal","steps":[],"transitions":[]}',
    );

    expect(result.success).toBe(true);
  });

  it('returns FL1001 for invalid JSON syntax', () => {
    const result = parseJson('{"name": }');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('FL1001');
      expect(result.format).toBe('json');
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('treats empty input as invalid JSON syntax', () => {
    const result = parseJson('');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('FL1001');
    }
  });

  it('allows syntax-valid JSON scalar input to remain untrusted', () => {
    expect(parseJson('42')).toEqual({ success: true, format: 'json', data: 42 });
  });

  it('allows syntax-valid JSON array input to remain untrusted', () => {
    expect(parseJson('[1,2,3]')).toEqual({ success: true, format: 'json', data: [1, 2, 3] });
  });

  it('preserves nested JSON metadata data', () => {
    const result = parseJson('{"metadata":{"owner":"platform","flags":[true,null,{"retries":2}]}}');

    expect(result).toEqual({
      success: true,
      format: 'json',
      data: {
        metadata: {
          owner: 'platform',
          flags: [true, null, { retries: 2 }],
        },
      },
    });
  });

  it('keeps HTML and script-like strings inert', () => {
    const script = '<script>globalThis.compromised=true</script>';
    const result = parseJson(JSON.stringify({ label: script }));

    expect(result).toEqual({ success: true, format: 'json', data: { label: script } });
    expect((globalThis as { compromised?: boolean }).compromised).toBeUndefined();
  });

  it('keeps JavaScript-like condition strings inert', () => {
    const condition = 'approved && dangerousCall()';
    const result = parseJson(JSON.stringify({ condition }));

    expect(result).toEqual({ success: true, format: 'json', data: { condition } });
  });
});
