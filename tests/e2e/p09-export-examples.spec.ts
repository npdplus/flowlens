import { readFileSync } from 'node:fs';
import { expect, test, type Download, type Page } from '@playwright/test';

const replaceEditor = async (page: Page, text: string) => {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(text);
};

const downloadedBytes = async (download: Download): Promise<Buffer> => {
  const path = await download.path();
  if (path === null) throw new Error('Expected a local download path.');
  return readFileSync(path);
};

const trackExternalRequests = (page: Page): string[] => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173')) external.push(request.url());
  });
  return external;
};

test('P09 Purchase Approval example remains editable and exports full local SVG and PNG artifacts', async ({
  page,
}) => {
  const externalRequests = trackExternalRequests(page);
  await page.goto('/');

  await page.getByLabel('Built-in workflow example').selectOption({ label: 'Purchase Approval' });
  await expect(page.getByLabel('Workflow input format')).toHaveValue('yaml');
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();
  await expect(
    page.locator('.react-flow__node').filter({ hasText: 'Manager Approval' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export workflow diagram as SVG' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Export workflow diagram as PNG' })).toBeEnabled();

  await page.locator('.react-flow__node').filter({ hasText: 'Manager Approval' }).click();
  const inspector = page.locator('.inspector-panel');
  await expect(inspector).toContainText('manager');
  await expect(inspector).toContainText('Manager Approval');

  const source = await page.locator('.cm-content').innerText();
  await replaceEditor(page, source.replace('Manager Approval', 'Manager Review'));
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();
  await expect(
    page.locator('.react-flow__node').filter({ hasText: 'Manager Review' }),
  ).toBeVisible();

  const [svgDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export workflow diagram as SVG' }).click(),
  ]);
  expect(svgDownload.suggestedFilename()).toBe('purchase-approval.svg');
  const svg = (await downloadedBytes(svgDownload)).toString('utf8');
  expect(svg.startsWith('<svg')).toBe(true);
  expect(svg).toContain('Manager Review');
  expect(svg).toContain('Condition:');
  expect(svg).toContain('Active');
  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/u);
  expect(viewBox).not.toBeNull();
  expect(Number(viewBox?.[1])).toBeGreaterThan(240);
  expect(Number(viewBox?.[2])).toBeGreaterThan(112);

  const [pngDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export workflow diagram as PNG' }).click(),
  ]);
  expect(pngDownload.suggestedFilename()).toBe('purchase-approval.png');
  const png = await downloadedBytes(pngDownload);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.length).toBeGreaterThan(1000);

  expect(externalRequests).toEqual([]);
});

test('P09 AI Agent example uses the normal pipeline and dark-theme export path', async ({
  page,
}) => {
  const externalRequests = trackExternalRequests(page);
  await page.goto('/');

  await page.getByLabel('Built-in workflow example').selectOption({ label: 'AI Agent Workflow' });
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();
  await expect(
    page.locator('.react-flow__node').filter({ hasText: 'Tool required?' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workflow analysis' })).toBeVisible();
  await expect(
    page.getByText('Tool needed · Condition: toolRequired == true', { exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('.flowlens-diagram')).toHaveAttribute('data-flowlens-theme', 'dark');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export workflow diagram as SVG' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('ai-agent-workflow.svg');
  const svg = (await downloadedBytes(download)).toString('utf8');
  expect(svg).toContain('fill="#111827"');
  expect(svg).toContain('Tool required?');
  expect(svg).toContain('retryCount &lt; 2');
  expect(externalRequests).toEqual([]);
});

test('P09 export keeps hostile-looking workflow strings inert and disables export for invalid input', async ({
  page,
}) => {
  const malicious = `schemaVersion: "0.1"
id: export-security
name: Export Security
steps:
  - id: start
    label: "<script>alert(1)</script>"
    type: start
    metadata:
      hidden: hidden-private-value
      url: "javascript:alert(1)"
  - id: done
    label: Done
    type: end
transitions:
  - id: finish
    source: start
    target: done
    label: "<b>Finish</b>"
    condition: "javascript:neverExecute()"
    metadata:
      remote: "https://example.invalid/private"
`;
  const externalRequests = trackExternalRequests(page);
  await page.goto('/');
  await replaceEditor(page, malicious);
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export workflow diagram as SVG' }).click(),
  ]);
  const svg = (await downloadedBytes(download)).toString('utf8');
  expect(svg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  expect(svg).toContain('javascript:neverExecute()');
  expect(svg).not.toMatch(/<script\b/iu);
  expect(svg).not.toContain('hidden-private-value');
  expect(svg).not.toContain('https://example.invalid/private');
  expect(svg).not.toMatch(/(?:href|src)="javascript:/iu);

  await replaceEditor(page, 'schemaVersion: "0.1"\nname: [');
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Export workflow diagram as SVG' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export workflow diagram as PNG' })).toBeDisabled();
  expect(externalRequests).toEqual([]);
});
