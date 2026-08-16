import { stat } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const replaceEditor = async (page: Page, text: string) => {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(text);
};

const buildSequentialWorkflow = (stepCount: number): string =>
  JSON.stringify({
    schemaVersion: '0.1',
    id: `p10-browser-${stepCount}`,
    name: `P10 Browser ${stepCount}`,
    steps: Array.from({ length: stepCount }, (_, index) => ({
      id: `step-${index + 1}`,
      label: `Step ${index + 1}`,
      type: index === 0 ? 'start' : index === stepCount - 1 ? 'end' : 'action',
    })),
    transitions: Array.from({ length: Math.max(0, stepCount - 1) }, (_, index) => ({
      source: `step-${index + 1}`,
      target: `step-${index + 2}`,
    })),
  });

test('measures representative browser processing, layout, render, interaction, and export', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'Google Chrome',
    'Browser performance is sampled in branded Chrome.',
  );
  test.setTimeout(180_000);

  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173')) externalRequests.push(request.url());
  });

  await page.goto('/');
  await page.getByLabel('Workflow input format').selectOption('json');

  for (const [category, stepCount] of [
    ['normal', 100],
    ['large', 500],
    ['stress', 1000],
  ] as const) {
    const source = buildSequentialWorkflow(stepCount);
    const startedAt = Date.now();
    await replaceEditor(page, source);
    await expect(page.locator('.react-flow__node')).toHaveCount(stepCount, {
      timeout: 120_000,
    });
    const readyMs = Date.now() - startedAt;

    const fitStartedAt = Date.now();
    await page.getByRole('button', { name: 'Fit workflow diagram to view' }).first().click();
    const fitMs = Date.now() - fitStartedAt;

    console.log(
      `[P10_BROWSER_PERFORMANCE] category=${category} steps=${stepCount} sourceBytes=${Buffer.byteLength(source)} readyMs=${readyMs} fitMs=${fitMs}`,
    );

    if (stepCount === 100) {
      const svgStartedAt = Date.now();
      const [svgDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export workflow diagram as SVG' }).click(),
      ]);
      const svgPath = await svgDownload.path();
      expect(svgPath).not.toBeNull();
      const svgBytes = svgPath === null ? 0 : (await stat(svgPath)).size;
      const svgMs = Date.now() - svgStartedAt;

      const pngStartedAt = Date.now();
      const [pngDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export workflow diagram as PNG' }).click(),
      ]);
      const pngPath = await pngDownload.path();
      expect(pngPath).not.toBeNull();
      const pngBytes = pngPath === null ? 0 : (await stat(pngPath)).size;
      const pngMs = Date.now() - pngStartedAt;

      console.log(
        `[P10_BROWSER_EXPORT_PERFORMANCE] steps=100 svgMs=${svgMs} svgBytes=${svgBytes} pngMs=${pngMs} pngBytes=${pngBytes}`,
      );
    }
  }

  expect(externalRequests).toEqual([]);
});
