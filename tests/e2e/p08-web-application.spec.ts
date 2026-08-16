import { expect, test, type Page } from '@playwright/test';

const validYaml = `schemaVersion: "0.1"
name: Browser journey
steps:
  - id: start
    label: Start
    type: start
  - id: review
    label: Review
  - id: done
    label: Done
    type: end
transitions:
  - source: start
    target: review
  - source: review
    target: done
`;

const updatedYaml = validYaml.replace('label: Review', 'label: Review updated');

const warningYaml = `schemaVersion: "0.1"
name: Decision warning
steps:
  - id: review
    label: Review
    type: decision
    description: "<script>inspect-only</script>"
    metadata:
      url: "javascript:alert(1)"
  - id: done
    label: Done
    type: end
transitions:
  - id: only-path
    source: review
    target: done
    condition: "approved === true"
`;

const localJson = JSON.stringify({
  schemaVersion: '0.1',
  name: 'Local JSON workflow',
  steps: [
    { id: 'opened', label: 'Opened locally', type: 'start' },
    { id: 'finished', label: 'Finished', type: 'end' },
  ],
  transitions: [{ source: 'opened', target: 'finished' }],
});

const replaceEditor = async (page: Page, text: string) => {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(text);
};

test('P08 browser application journey stays local and updates safely', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173')) externalRequests.push(request.url());
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'FlowLens', exact: true })).toBeVisible();
  await expect(
    page.getByText('FlowLens processes workflow definitions locally in your browser.'),
  ).toBeVisible();
  await expect(page.locator('.cm-content')).toHaveAttribute(
    'aria-label',
    'Workflow definition editor',
  );

  await replaceEditor(page, validYaml);
  await expect(page.locator('.cm-lineNumbers')).toBeVisible();
  await expect(page.locator('.cm-content span').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Review' })).toBeVisible();

  await replaceEditor(page, updatedYaml);
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).not.toBeVisible();
  await expect(page.getByText('Processing current definition locally…')).toBeVisible();
  await expect(
    page.locator('.react-flow__node').filter({ hasText: 'Review updated' }),
  ).toBeVisible();

  await replaceEditor(page, 'schemaVersion: "0.1"\nname: [');
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).not.toBeVisible();
  await expect(page.getByText('FL1002')).toBeVisible();
  const parseDiagnostic = page.getByRole('button', { name: /FL1002:/ });
  await expect(parseDiagnostic).toBeVisible();
  await parseDiagnostic.click();
  await expect(page.locator('.cm-editor')).toHaveClass(/cm-focused/);

  await replaceEditor(page, warningYaml);
  await expect(page.getByText('FL2105')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workflow analysis' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();

  const reviewNode = page.locator('.react-flow__node').filter({ hasText: 'Review' });
  await reviewNode.click();
  const inspector = page.locator('.inspector-panel');
  await expect(inspector).toContainText('review');
  await expect(inspector).toContainText('decision');
  await expect(inspector).toContainText('<script>inspect-only</script>');
  await expect(inspector).toContainText('approved === true');
  await expect(inspector.locator('a[href^="javascript:"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.flowlens-diagram')).toHaveAttribute('data-flowlens-theme', 'dark');

  await page.reload();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.cm-content')).toHaveText('');
  await expect(
    page.getByText('Paste, edit, or open a JSON/YAML workflow definition.'),
  ).toBeVisible();

  await page.getByLabel('Open workflow definition file').setInputFiles({
    name: 'local.json',
    mimeType: 'application/json',
    buffer: Buffer.from(localJson),
  });
  await expect(page.getByLabel('Workflow input format')).toHaveValue('json');
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();
  await expect(
    page.locator('.react-flow__node').filter({ hasText: 'Opened locally' }),
  ).toBeVisible();
  expect(externalRequests).toEqual([]);
});
