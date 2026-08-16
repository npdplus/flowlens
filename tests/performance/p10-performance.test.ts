import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { layoutWorkflow } from '@flowlens/react';

import { processWorkflowText } from '../../apps/web/src/processing';

interface Measurement {
  readonly steps: number;
  readonly transitions: number;
  readonly processingMs: number;
  readonly layoutMs: number;
  readonly totalMs: number;
  readonly width: number;
  readonly height: number;
}

const buildSequentialWorkflow = (stepCount: number): string => {
  const steps = Array.from({ length: stepCount }, (_, index) => ({
    id: `step-${index + 1}`,
    label: `Step ${index + 1}`,
    type: index === 0 ? 'start' : index === stepCount - 1 ? 'end' : 'action',
  }));
  const transitions = Array.from({ length: Math.max(0, stepCount - 1) }, (_, index) => ({
    source: `step-${index + 1}`,
    target: `step-${index + 2}`,
  }));

  return JSON.stringify({
    schemaVersion: '0.1',
    id: `p10-performance-${stepCount}`,
    name: `P10 Performance ${stepCount}`,
    steps,
    transitions,
  });
};

const measure = async (stepCount: number): Promise<Measurement> => {
  const source = buildSequentialWorkflow(stepCount);
  const processingStarted = performance.now();
  const result = processWorkflowText(source, 'json');
  const processingFinished = performance.now();

  expect(result.stage).toBe('ready');
  expect(result.diagramWorkflow).toBeDefined();
  if (result.diagramWorkflow === undefined) {
    throw new Error('Expected a renderable performance workflow.');
  }

  const layoutStarted = performance.now();
  const layout = await layoutWorkflow(result.diagramWorkflow);
  const layoutFinished = performance.now();

  expect(layout.ok).toBe(true);
  if (!layout.ok) {
    throw new Error(layout.error.message);
  }

  return {
    steps: stepCount,
    transitions: Math.max(0, stepCount - 1),
    processingMs: processingFinished - processingStarted,
    layoutMs: layoutFinished - layoutStarted,
    totalMs: layoutFinished - processingStarted,
    width: layout.bounds.width,
    height: layout.bounds.height,
  };
};

describe('P10 representative performance measurements', () => {
  it.each([
    ['normal', 100],
    ['large', 500],
    ['stress', 1000],
  ] as const)('measures %s workflow behavior at %i steps', async (category, stepCount) => {
    const measurement = await measure(stepCount);
    console.log(
      `[P10_PERFORMANCE] category=${category} steps=${measurement.steps} transitions=${measurement.transitions} processingMs=${measurement.processingMs.toFixed(2)} layoutMs=${measurement.layoutMs.toFixed(2)} totalMs=${measurement.totalMs.toFixed(2)} bounds=${measurement.width.toFixed(0)}x${measurement.height.toFixed(0)}`,
    );

    expect(measurement.processingMs).toBeGreaterThanOrEqual(0);
    expect(measurement.layoutMs).toBeGreaterThanOrEqual(0);
    expect(measurement.width).toBeGreaterThan(0);
    expect(measurement.height).toBeGreaterThan(0);
  });
});
