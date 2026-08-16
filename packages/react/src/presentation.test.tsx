import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FLOWLENS_ARIA_LABEL_CONFIG, FLOWLENS_READ_ONLY_INTERACTION } from './diagram';
import { FlowLensStepContent } from './step-node';
import type { FlowLensStepNodeData } from './types';

const data = (overrides: Partial<FlowLensStepNodeData> = {}): FlowLensStepNodeData => ({
  stepId: 'safe-step',
  label: 'Safe step',
  stepType: 'action',
  statusLabel: 'No status',
  statusSymbol: '—',
  ...overrides,
});

describe('P07 safe and accessible presentation', () => {
  it('renders HTML-like and script-like labels as escaped inert text', () => {
    const markup = renderToStaticMarkup(
      <FlowLensStepContent data={data({ label: '<script>globalThis.pwned=true</script>' })} />,
    );

    expect(markup).toContain('&lt;script&gt;globalThis.pwned=true&lt;/script&gt;');
    expect(markup).not.toContain('<script>');
  });

  it('renders unsafe-looking URLs as text without creating navigation', () => {
    const markup = renderToStaticMarkup(
      <FlowLensStepContent
        data={data({ description: 'javascript:alert(1) https://private.invalid/workflow' })}
      />,
    );

    expect(markup).toContain('javascript:alert(1)');
    expect(markup).not.toContain('href=');
  });

  it('communicates status through visible text, symbol, and an accessible label', () => {
    const markup = renderToStaticMarkup(
      <FlowLensStepContent
        data={data({ status: 'success', statusLabel: 'Success', statusSymbol: '✓' })}
      />,
    );

    expect(markup).toContain('Success');
    expect(markup).toContain('Status: Success');
    expect(markup).toContain('✓');
  });

  it('keeps missing status explicit and neutral', () => {
    const markup = renderToStaticMarkup(<FlowLensStepContent data={data()} />);

    expect(markup).toContain('No status');
    expect(markup).toContain('Status: No status');
  });

  it('exposes accessible names for zoom and fit controls', () => {
    expect(FLOWLENS_ARIA_LABEL_CONFIG).toMatchObject({
      'controls.ariaLabel': 'FlowLens diagram controls',
      'controls.zoomIn.ariaLabel': 'Zoom in workflow diagram',
      'controls.zoomOut.ariaLabel': 'Zoom out workflow diagram',
      'controls.fitView.ariaLabel': 'Fit workflow diagram to view',
    });
  });

  it('locks semantic editing while retaining pan, zoom, and selection', () => {
    expect(FLOWLENS_READ_ONLY_INTERACTION).toEqual({
      nodesDraggable: false,
      nodesConnectable: false,
      edgesReconnectable: false,
      deleteKeyCode: null,
      elementsSelectable: true,
      panOnDrag: true,
      zoomOnScroll: true,
      zoomOnPinch: true,
      zoomOnDoubleClick: true,
    });
  });
});
