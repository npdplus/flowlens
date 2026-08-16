import { describe, expect, it } from 'vitest';

import { FLOWLENS_CORE_FOUNDATION } from './index';

describe('@flowlens/core P01 foundation', () => {
  it('exports only the repository-foundation marker used by smoke tests', () => {
    expect(FLOWLENS_CORE_FOUNDATION).toEqual({
      packageName: '@flowlens/core',
      phase: 'P01',
      purpose: 'repository-foundation',
    });
  });
});
