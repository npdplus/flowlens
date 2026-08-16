import { expect, test, type Page } from '@playwright/test';

const replaceEditor = async (page: Page, text: string) => {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(text);
};

const validJson = JSON.stringify({
  schemaVersion: '0.1',
  id: 'p10-json',
  name: 'P10 JSON',
  steps: [
    { id: 'start', label: 'Start', type: 'start' },
    { id: 'done', label: 'Done', type: 'end' },
  ],
  transitions: [{ source: 'start', target: 'done' }],
});

const validYaml = `schemaVersion: "0.1"
id: p10-yaml
name: P10 YAML
steps:
  - id: start
    label: Start
    type: start
  - id: done
    label: Done
    type: end
transitions:
  - source: start
    target: done
`;

const externalRequestTracker = (page: Page): string[] => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173')) external.push(request.url());
  });
  return external;
};

test('records exact browser evidence and verifies JSON/YAML production paths', async ({
  page,
  browser,
  browserName,
}, testInfo) => {
  const externalRequests = externalRequestTracker(page);
  console.log(
    `[P10_BROWSER] project=${testInfo.project.name} engine=${browserName} version=${browser.version()} platform=${process.platform}`,
  );

  await page.goto('/');
  await page.getByLabel('Workflow input format').selectOption('json');
  await replaceEditor(page, validJson);
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Done' })).toBeVisible();

  await page.getByLabel('Workflow input format').selectOption('yaml');
  await replaceEditor(page, validYaml);
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Done' })).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test('verifies all five official examples through the browser production pipeline', async ({
  page,
}) => {
  const externalRequests = externalRequestTracker(page);
  await page.goto('/');
  const selector = page.getByLabel('Built-in workflow example');
  const examples = [
    'Simple Sequential Workflow',
    'Purchase Approval',
    'CI/CD Deployment',
    'AI Agent Workflow',
    'Incident Response',
  ];

  for (const label of examples) {
    await selector.selectOption({ label });
    await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Export workflow diagram as SVG' }),
    ).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Export workflow diagram as PNG' }),
    ).toBeEnabled();
  }

  expect(externalRequests).toEqual([]);
});

test('verifies baseline keyboard, naming, focus, status, and export feedback accessibility', async ({
  page,
}) => {
  await page.goto('/');

  const themeButton = page.getByRole('button', { name: 'Switch to dark theme' });
  await themeButton.focus();
  await expect(themeButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'dark');

  const editor = page.getByLabel('Workflow definition editor');
  await editor.focus();
  await expect(editor).toBeFocused();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(editor).not.toBeFocused();

  const svgExport = page.getByRole('button', { name: 'Export workflow diagram as SVG' });
  const pngExport = page.getByRole('button', { name: 'Export workflow diagram as PNG' });
  await expect(svgExport).toBeDisabled();
  await expect(pngExport).toBeDisabled();

  await page.getByLabel('Built-in workflow example').selectOption({ label: 'Purchase Approval' });
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Active' })).toBeVisible();

  const fitButton = page.getByRole('button', { name: 'Fit workflow diagram to view' }).first();
  await fitButton.focus();
  await expect(fitButton).toBeFocused();
  await page.keyboard.press('Enter');

  const managerNode = page.locator('.react-flow__node').filter({ hasText: 'Manager Approval' });
  await managerNode.focus();
  await expect(managerNode).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.inspector-panel')).toContainText('Manager Approval');

  const [download] = await Promise.all([page.waitForEvent('download'), svgExport.click()]);
  expect(download.suggestedFilename()).toBe('purchase-approval.svg');
  await expect(page.getByRole('status')).toContainText('SVG exported locally.');
});

test('invalid input fails safely and leaves export disabled', async ({ page }) => {
  await page.goto('/');
  await replaceEditor(page, 'schemaVersion: "0.1"\nname: [');
  await expect(page.getByText('FL1002')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Export workflow diagram as SVG' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export workflow diagram as PNG' })).toBeDisabled();
});
