import { expect, test } from '@playwright/test';

test('decision branch transition labels do not overlap in live or exported diagrams', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Built-in workflow example').selectOption({ label: 'Purchase Approval' });
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();

  const liveSpacing = await page.locator('g.react-flow__edge-textwrapper').evaluateAll((elements) => {
    const approved = elements.find((element) => element.textContent?.includes('Approved · Condition:'));
    const rejected = elements.find((element) => element.textContent?.includes('Rejected · Condition:'));
    if (approved === undefined || rejected === undefined) {
      throw new Error('Expected both Purchase Approval branch labels.');
    }
    const approvedBounds = approved.getBoundingClientRect();
    const rejectedBounds = rejected.getBoundingClientRect();
    return {
      approvedRight: approvedBounds.right,
      rejectedLeft: rejectedBounds.left,
      gap: rejectedBounds.left - approvedBounds.right,
    };
  });

  expect(liveSpacing.approvedRight).toBeLessThan(liveSpacing.rejectedLeft);
  expect(liveSpacing.gap).toBeGreaterThan(12);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export workflow diagram as SVG' }).click(),
  ]);
  const path = await download.path();
  if (path === null) throw new Error('Expected a local SVG download path.');
  const svg = await (await import('node:fs/promises')).readFile(path, 'utf8');

  await page.setContent(svg);
  const exportedSpacing = await page.locator('g.react-flow__edge-textwrapper').evaluateAll((elements) => {
    const approved = elements.find((element) => element.textContent?.includes('Approved · Condition:'));
    const rejected = elements.find((element) => element.textContent?.includes('Rejected · Condition:'));
    if (approved === undefined || rejected === undefined) {
      throw new Error('Expected both exported Purchase Approval branch labels.');
    }
    const approvedBounds = approved.getBoundingClientRect();
    const rejectedBounds = rejected.getBoundingClientRect();
    return {
      approvedRight: approvedBounds.right,
      rejectedLeft: rejectedBounds.left,
      gap: rejectedBounds.left - approvedBounds.right,
    };
  });

  expect(exportedSpacing.approvedRight).toBeLessThan(exportedSpacing.rejectedLeft);
  expect(exportedSpacing.gap).toBeGreaterThan(12);
});
