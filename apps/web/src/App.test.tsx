import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('FlowLens P09 web application shell', () => {
  it('renders local-first examples, export controls, validation, analysis, diagram, and inspector workspace', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('FlowLens');
    expect(markup).toContain('Understand. Validate. Visualize.');
    expect(markup).toContain('FlowLens processes workflow definitions locally in your browser.');
    expect(markup).toContain('Workflow definition');
    expect(markup).toContain('Built-in workflow example');
    expect(markup).toContain('Simple Sequential Workflow');
    expect(markup).toContain('Purchase Approval');
    expect(markup).toContain('CI/CD Deployment');
    expect(markup).toContain('AI Agent Workflow');
    expect(markup).toContain('Incident Response');
    expect(markup).toContain('Workflow input format');
    expect(markup).toContain('Open local file');
    expect(markup).toContain('Export SVG');
    expect(markup).toContain('Export PNG');
    expect(markup).toContain('Diagnostics');
    expect(markup).toContain('Workflow analysis');
    expect(markup).toContain('Diagram');
    expect(markup).toContain('Inspector');
    expect(markup).toContain('Switch to dark theme');
    expect(markup).not.toContain('Repository foundation ready');
    expect(markup).not.toContain('Not implemented in P01');
  });
});
