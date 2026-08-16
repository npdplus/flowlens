import { readFileSync } from 'node:fs';
import { expect, test, type Download, type Page } from '@playwright/test';

const downloadedBytes = async (download: Download): Promise<Buffer> => {
  const path = await download.path();
  if (path === null) throw new Error('Expected a local download path.');
  return readFileSync(path);
};

const selectExample = async (page: Page, label: string): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Built-in workflow example').selectOption({ label });
  await expect(page.getByRole('region', { name: 'Workflow diagram' })).toBeVisible();
};

test('standalone export keeps connectors at full workflow bounds', async ({ page }) => {
  await selectExample(page, 'Simple Sequential Workflow');

  const [svgDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export workflow diagram as SVG' }).click(),
  ]);
  const svg = (await downloadedBytes(svgDownload)).toString('utf8');

  const geometry = await page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, 'image/svg+xml');
    const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
    const edgeLayer = document.querySelector<HTMLElement>('.react-flow__edges');
    if (viewport === null || edgeLayer === null) throw new Error('Export geometry is incomplete.');

    const edgeSvgs = Array.from(edgeLayer.children).filter(
      (element): element is SVGSVGElement =>
        element.namespaceURI === 'http://www.w3.org/2000/svg' && element.localName === 'svg',
    );
    const edgePaths = Array.from(
      document.querySelectorAll<SVGPathElement>('path.react-flow__edge-path'),
    );

    return {
      viewportWidth: Number.parseFloat(viewport.style.width),
      viewportHeight: Number.parseFloat(viewport.style.height),
      edgeLayerWidth: Number.parseFloat(edgeLayer.style.width),
      edgeLayerHeight: Number.parseFloat(edgeLayer.style.height),
      edgeSvgWidths: edgeSvgs.map((element) => Number.parseFloat(element.style.width)),
      edgeSvgHeights: edgeSvgs.map((element) => Number.parseFloat(element.style.height)),
      edgeSvgViewBoxes: edgeSvgs.map((element) => element.getAttribute('viewBox')),
      edgePathCount: edgePaths.length,
    };
  }, svg);

  expect(geometry.viewportWidth).toBeGreaterThan(300);
  expect(geometry.viewportHeight).toBeGreaterThan(150);
  expect(geometry.edgeLayerWidth).toBe(geometry.viewportWidth);
  expect(geometry.edgeLayerHeight).toBe(geometry.viewportHeight);
  expect(geometry.edgeSvgWidths.length).toBeGreaterThan(0);
  expect(geometry.edgeSvgWidths.every((width) => width === geometry.viewportWidth)).toBe(true);
  expect(geometry.edgeSvgHeights.every((height) => height === geometry.viewportHeight)).toBe(true);
  expect(
    geometry.edgeSvgViewBoxes.every(
      (viewBox) => viewBox === `0 0 ${geometry.viewportWidth} ${geometry.viewportHeight}`,
    ),
  ).toBe(true);
  expect(geometry.edgePathCount).toBe(2);

  const [pngDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export workflow diagram as PNG' }).click(),
  ]);
  const png = await downloadedBytes(pngDownload);
  const pngBase64 = png.toString('base64');

  const rasterEvidence = await page.evaluate(
    async ({ svgSource, pngSource }) => {
      const parsed = new DOMParser().parseFromString(svgSource, 'image/svg+xml');
      const root = parsed.documentElement;
      const sourcePath = parsed.querySelector<SVGPathElement>('path.react-flow__edge-path');
      const d = sourcePath?.getAttribute('d');
      if (d === null || d === undefined) throw new Error('Expected an exported connector path.');

      const measurementSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const measurementPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      measurementSvg.style.position = 'fixed';
      measurementSvg.style.left = '-10000px';
      measurementSvg.style.top = '-10000px';
      measurementPath.setAttribute('d', d);
      measurementSvg.append(measurementPath);
      document.body.append(measurementSvg);
      const point = measurementPath.getPointAtLength(measurementPath.getTotalLength() * 0.25);
      measurementSvg.remove();

      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Exported PNG could not be decoded.'));
        image.src = `data:image/png;base64,${pngSource}`;
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('Canvas is unavailable.');
      context.drawImage(image, 0, 0);

      const svgWidth = Number(root.getAttribute('width'));
      const scale = image.naturalWidth / svgWidth;
      const x = Math.round((96 + point.x) * scale);
      const y = Math.round((96 + point.y) * scale);
      const sample = context.getImageData(x - 3, y - 3, 7, 7).data;
      let connectorLikePixels = 0;
      for (let index = 0; index < sample.length; index += 4) {
        const red = sample[index] ?? 255;
        const green = sample[index + 1] ?? 255;
        const blue = sample[index + 2] ?? 255;
        const alpha = sample[index + 3] ?? 0;
        if (alpha > 0 && red < 180 && green < 180 && blue < 180) connectorLikePixels += 1;
      }

      return { connectorLikePixels, x, y, scale };
    },
    { svgSource: svg, pngSource: pngBase64 },
  );

  expect(rasterEvidence.scale).toBeGreaterThan(0);
  expect(rasterEvidence.x).toBeGreaterThan(0);
  expect(rasterEvidence.y).toBeGreaterThan(0);
  expect(rasterEvidence.connectorLikePixels).toBeGreaterThan(0);
});
