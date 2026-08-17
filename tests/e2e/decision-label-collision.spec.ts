import { readFileSync } from 'node:fs';
import { expect, test, type Download, type Locator, type Page } from '@playwright/test';

const downloadedText = async (download: Download): Promise<string> => {
  const path = await download.path();
  if (path === null) throw new Error('Expected a local download path.');
  return readFileSync(path, 'utf8');
};

const labelWrapper = (page: Page, text: string): Locator =>
  page.locator('g.react-flow__edge-textwrapper').filter({ hasText: text });

const expectNoHorizontalOverlap = async (first: Locator, second: Locator): Promise<void> => {
  await expect(first).toHaveCount(1);
  await expect(second).toHaveCount(1);
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  if (firstBox === null || secondBox === null) throw new Error('Expected rendered edge-label bounds.');

  const left = firstBox.x <= secondBox.x ? firstBox : secondBox;
  const right = firstBox.x <= secondBox.x ? secondBox : firstBox;
  expect(left.x + left.width).toBeLessThanOrEqual(right.x);
};

test('decision branch labels remain separated in the live diagram and standalone export', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Built-in workflow example').selectOption({ label: 'Purchase Approval' });
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();

  const approvedText = 'Approved · Condition: amount < 5000 or managerOverride == true';
  const rejectedText = 'Rejected · Condition: approved == false';

  await expectNoHorizontalOverlap(
    labelWrapper(page, approvedText),
    labelWrapper(page, rejectedText),
  );

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export workflow diagram as SVG' }).click(),
  ]);
  const svg = await downloadedText(download);
  await page.setContent(svg);

  await expectNoHorizontalOverlap(
    labelWrapper(page, approvedText),
    labelWrapper(page, rejectedText),
  );
});
