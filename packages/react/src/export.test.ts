import { describe, expect, it } from 'vitest';

import {
  FLOWLENS_EXPORT_PADDING,
  FLOWLENS_PNG_MAX_DIMENSION,
  exportDiagramPng,
  exportDiagramSvg,
  getPngExportDimensions,
  isSafeExportStyleValue,
} from './export';

describe('P09 diagram export safety helpers', () => {
  it('uses predictable full-bounds padding', () => {
    expect(FLOWLENS_EXPORT_PADDING).toBe(96);
  });

  it('allows local SVG fragment resources but rejects remote and javascript-like CSS resources', () => {
    expect(isSafeExportStyleValue('url("#arrow")')).toBe(true);
    expect(isSafeExportStyleValue('none')).toBe(true);
    expect(isSafeExportStyleValue('url("https://example.invalid/remote.svg")')).toBe(false);
    expect(isSafeExportStyleValue('url("javascript:alert(1)")')).toBe(false);
  });

  it('uses 2x PNG output when safe and caps oversized output dimensions', () => {
    expect(getPngExportDimensions(1200, 800)).toEqual({ width: 2400, height: 1600, scale: 2 });
    const large = getPngExportDimensions(10_000, 5_000);
    expect(large.width).toBe(FLOWLENS_PNG_MAX_DIMENSION);
    expect(large.height).toBe(4096);
    expect(large.scale).toBeCloseTo(0.8192);
  });

  it('rejects invalid export dimensions', () => {
    expect(() => getPngExportDimensions(0, 100)).toThrow();
    expect(() => getPngExportDimensions(Number.POSITIVE_INFINITY, 100)).toThrow();
  });

  it('fails SVG and PNG export safely when no rendered surface is available', async () => {
    await expect(exportDiagramSvg(null, null, 'light')).resolves.toMatchObject({
      ok: false,
      error: { code: 'export-failed' },
    });
    await expect(exportDiagramPng(null, null, 'dark')).resolves.toMatchObject({
      ok: false,
      error: { code: 'export-failed' },
    });
  });
});
