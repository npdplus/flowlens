import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FlowLensFoundationBadge } from './index';

describe('@flowlens/react P01 foundation', () => {
  it('can consume the core package without owning workflow semantics', () => {
    const markup = renderToStaticMarkup(<FlowLensFoundationBadge />);

    expect(markup).toContain('Core → React boundary ready');
    expect(markup).toContain('data-flowlens-foundation="P01"');
  });
});
