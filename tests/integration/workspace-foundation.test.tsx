import { FLOWLENS_CORE_FOUNDATION } from '@flowlens/core';
import { FlowLensFoundationBadge } from '@flowlens/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('P01 workspace integration', () => {
  it('resolves the intended Core → React dependency direction', () => {
    const markup = renderToStaticMarkup(<FlowLensFoundationBadge />);

    expect(FLOWLENS_CORE_FOUNDATION.packageName).toBe('@flowlens/core');
    expect(markup).toContain('Core → React boundary ready');
  });
});
