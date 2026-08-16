import type { FlowLensRendererModel, FlowLensTheme } from './types';

export const FLOWLENS_EXPORT_PADDING = 96;
export const FLOWLENS_PNG_PREFERRED_SCALE = 2;
export const FLOWLENS_PNG_MAX_DIMENSION = 8192;

const SVG_MIME_TYPE = 'image/svg+xml;charset=utf-8';
const PNG_MIME_TYPE = 'image/png';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const UNSAFE_ELEMENTS = 'script,iframe,object,embed,link,meta,base';
const STRIPPED_ATTRIBUTES = new Set([
  'href',
  'xlink:href',
  'src',
  'srcset',
  'tabindex',
  'contenteditable',
  'title',
]);

export interface FlowLensDiagramExportArtifact {
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly mimeType: typeof SVG_MIME_TYPE | typeof PNG_MIME_TYPE;
}

export interface FlowLensDiagramExportError {
  readonly kind: 'export';
  readonly code: 'export-failed';
  readonly message: string;
}

export type FlowLensDiagramExportResult =
  | { readonly ok: true; readonly artifact: FlowLensDiagramExportArtifact }
  | { readonly ok: false; readonly error: FlowLensDiagramExportError };

const EXPORT_FAILURE: FlowLensDiagramExportResult = Object.freeze({
  ok: false,
  error: Object.freeze({
    kind: 'export',
    code: 'export-failed',
    message: 'Unable to export this workflow diagram.',
  }),
});

const themeBackground = (theme: FlowLensTheme): string =>
  theme === 'dark' ? '#111827' : '#f7f8fb';

/** Only fragment-local CSS resources are allowed into the standalone export. */
export const isSafeExportStyleValue = (value: string): boolean => {
  const matches = value.match(/url\(([^)]+)\)/giu);
  if (matches === null) return true;
  return matches.every((match) => {
    const inner = match
      .slice(4, -1)
      .trim()
      .replace(/^['"]|['"]$/gu, '');
    return inner.startsWith('#') && !inner.includes('javascript:');
  });
};

export const getPngExportDimensions = (
  width: number,
  height: number,
): { readonly width: number; readonly height: number; readonly scale: number } => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid export dimensions.');
  }
  const scale = Math.min(
    FLOWLENS_PNG_PREFERRED_SCALE,
    FLOWLENS_PNG_MAX_DIMENSION / width,
    FLOWLENS_PNG_MAX_DIMENSION / height,
  );
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid export scale.');
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
};

const stripUnsafeAttributes = (root: Element): void => {
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const attribute of element.getAttributeNames()) {
      const lower = attribute.toLowerCase();
      if (
        lower.startsWith('on') ||
        lower.startsWith('data-') ||
        lower.startsWith('aria-') ||
        STRIPPED_ATTRIBUTES.has(lower)
      ) {
        element.removeAttribute(attribute);
      }
    }
  }
  root.querySelectorAll(UNSAFE_ELEMENTS).forEach((element) => element.remove());
};

const inlineSafeComputedStyles = (sourceRoot: Element, cloneRoot: Element): void => {
  const sourceElements = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll('*'))];
  const cloneElements = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll('*'))];
  if (sourceElements.length !== cloneElements.length) {
    throw new Error('Export surface could not be cloned deterministically.');
  }

  const view = sourceRoot.ownerDocument.defaultView;
  if (view === null) throw new Error('Export surface is not attached to a browser window.');

  for (let index = 0; index < sourceElements.length; index += 1) {
    const source = sourceElements[index];
    const clone = cloneElements[index];
    if (source === undefined || clone === undefined) continue;
    const computed = view.getComputedStyle(source);
    let styleText = '';
    for (let propertyIndex = 0; propertyIndex < computed.length; propertyIndex += 1) {
      const property = computed.item(propertyIndex);
      if (property.length === 0) continue;
      // SVG transform presentation attributes (for example React Flow edge-label wrappers)
      // must remain authoritative in the standalone export. Inlining the computed CSS
      // `transform: none` would override the cloned `transform="translate(...)"` attribute
      // and collapse labels to the SVG origin.
      if (
        property === 'transform' &&
        source.namespaceURI === SVG_NAMESPACE &&
        source.hasAttribute('transform')
      ) {
        continue;
      }
      const value = computed.getPropertyValue(property);
      if (!isSafeExportStyleValue(value)) continue;
      styleText += `${property}:${value};`;
    }
    clone.setAttribute('style', styleText);
  }
};

const preserveNestedSvgNamespaces = (cloneRoot: HTMLElement): void => {
  for (const svg of Array.from(cloneRoot.querySelectorAll<SVGSVGElement>('svg'))) {
    if (svg.namespaceURI === SVG_NAMESPACE) {
      // The clone originated in an HTML document, where SVG namespace membership is
      // implicit and outerHTML does not need to emit xmlns. The standalone artifact is
      // XML, however, and these SVGs sit below an XHTML foreignObject container. Without
      // an explicit xmlns declaration they are reparsed as XHTML elements and connector
      // paths disappear when the exported SVG is loaded as an image.
      svg.setAttribute('xmlns', SVG_NAMESPACE);
    }
  }
};

const normalizeExportEdgeGeometry = (
  cloneRoot: HTMLElement,
  width: number,
  height: number,
): void => {
  const edgeLayer = cloneRoot.querySelector<HTMLElement>('.react-flow__edges');
  if (edgeLayer === null) return;

  // React Flow's live edge layer intentionally relies on overflow-visible SVGs whose
  // computed layout can report a zero-sized parent and the SVG default 300x150 viewport.
  // Those computed pixel dimensions become destructive once they are inlined into a
  // standalone export. Expand the cloned edge layer and each direct SVG child to the
  // full workflow bounds so path coordinates and edge-label transforms keep the same
  // coordinate system used by the nodes.
  edgeLayer.style.position = 'absolute';
  edgeLayer.style.top = '0';
  edgeLayer.style.left = '0';
  edgeLayer.style.right = 'auto';
  edgeLayer.style.bottom = 'auto';
  edgeLayer.style.width = `${width}px`;
  edgeLayer.style.height = `${height}px`;
  edgeLayer.style.overflow = 'visible';

  for (const child of Array.from(edgeLayer.children)) {
    if (child.namespaceURI !== SVG_NAMESPACE || child.localName !== 'svg') continue;
    const svg = child as SVGSVGElement;
    svg.setAttribute('width', `${width}`);
    svg.setAttribute('height', `${height}`);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.right = 'auto';
    svg.style.bottom = 'auto';
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
    svg.style.transform = 'none';
    svg.style.transformOrigin = '0 0';
    svg.style.overflow = 'visible';
  }
};

const createStandaloneSvg = (
  surface: HTMLElement,
  model: FlowLensRendererModel,
  theme: FlowLensTheme,
): { readonly source: string; readonly width: number; readonly height: number } => {
  const viewport = surface.querySelector<HTMLElement>('.react-flow__viewport');
  if (viewport === null) throw new Error('Rendered diagram viewport is unavailable.');

  const clone = viewport.cloneNode(true);
  if (!(clone instanceof HTMLElement)) {
    throw new Error('Rendered diagram viewport could not be cloned.');
  }

  inlineSafeComputedStyles(viewport, clone);
  stripUnsafeAttributes(clone);

  clone.style.position = 'relative';
  clone.style.inset = 'auto';
  clone.style.width = `${model.bounds.width}px`;
  clone.style.height = `${model.bounds.height}px`;
  clone.style.minWidth = '0';
  clone.style.minHeight = '0';
  clone.style.transform = 'none';
  clone.style.transformOrigin = '0 0';
  clone.style.overflow = 'visible';
  normalizeExportEdgeGeometry(clone, model.bounds.width, model.bounds.height);
  preserveNestedSvgNamespaces(clone);

  const width = Math.ceil(model.bounds.width + FLOWLENS_EXPORT_PADDING * 2);
  const height = Math.ceil(model.bounds.height + FLOWLENS_EXPORT_PADDING * 2);
  if (width <= 0 || height <= 0) throw new Error('Rendered diagram bounds are unavailable.');

  const background = themeBackground(theme);
  const source = `<svg xmlns="${SVG_NAMESPACE}" xmlns:xhtml="${XHTML_NAMESPACE}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="FlowLens workflow diagram"><rect width="100%" height="100%" fill="${background}"/><foreignObject x="0" y="0" width="${width}" height="${height}"><div xmlns="${XHTML_NAMESPACE}" style="box-sizing:border-box;position:relative;width:${width}px;height:${height}px;padding:${FLOWLENS_EXPORT_PADDING}px;overflow:hidden;background:${background};">${clone.outerHTML}</div></foreignObject></svg>`;
  return { source, width, height };
};

const svgArtifact = (
  surface: HTMLElement,
  model: FlowLensRendererModel,
  theme: FlowLensTheme,
): FlowLensDiagramExportArtifact => {
  const svg = createStandaloneSvg(surface, model, theme);
  return {
    blob: new Blob([svg.source], { type: SVG_MIME_TYPE }),
    width: svg.width,
    height: svg.height,
    mimeType: SVG_MIME_TYPE,
  };
};

const blobDataUrl = async (blob: Blob): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('SVG data could not be prepared for rasterization.'));
      }
    };
    reader.onerror = () => reject(new Error('SVG data could not be prepared for rasterization.'));
    reader.readAsDataURL(blob);
  });

const imageFromBlob = async (blob: Blob): Promise<HTMLImageElement> => {
  const imageUrl = await blobDataUrl(blob);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('SVG could not be rasterized.'));
    image.src = imageUrl;
  });
  return image;
};

const pngArtifact = async (
  surface: HTMLElement,
  model: FlowLensRendererModel,
  theme: FlowLensTheme,
): Promise<FlowLensDiagramExportArtifact> => {
  const svg = svgArtifact(surface, model, theme);
  const image = await imageFromBlob(svg.blob);
  const dimensions = getPngExportDimensions(svg.width, svg.height);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas is unavailable.');
  context.fillStyle = themeBackground(theme);
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, PNG_MIME_TYPE);
  });
  if (blob === null) throw new Error('PNG could not be created.');
  return {
    blob,
    width: dimensions.width,
    height: dimensions.height,
    mimeType: PNG_MIME_TYPE,
  };
};

export const exportDiagramSvg = async (
  surface: HTMLElement | null,
  model: FlowLensRendererModel | null,
  theme: FlowLensTheme,
): Promise<FlowLensDiagramExportResult> => {
  if (surface === null || model === null) return EXPORT_FAILURE;
  try {
    return { ok: true, artifact: svgArtifact(surface, model, theme) };
  } catch {
    return EXPORT_FAILURE;
  }
};

export const exportDiagramPng = async (
  surface: HTMLElement | null,
  model: FlowLensRendererModel | null,
  theme: FlowLensTheme,
): Promise<FlowLensDiagramExportResult> => {
  if (surface === null || model === null) return EXPORT_FAILURE;
  try {
    return { ok: true, artifact: await pngArtifact(surface, model, theme) };
  } catch {
    return EXPORT_FAILURE;
  }
};
