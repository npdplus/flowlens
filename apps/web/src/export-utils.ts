import type { CanonicalWorkflow } from '@flowlens/core';

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu;

export const safeWorkflowFileStem = (workflow: CanonicalWorkflow): string => {
  const preferred = workflow.id?.trim() || workflow.name.trim();
  const normalized = preferred
    .normalize('NFKD')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/gu, '-')
    .replace(/\s+/gu, '-')
    .replace(/[^a-zA-Z0-9._-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^[._-]+|[._-]+$/gu, '')
    .slice(0, 80)
    .replace(/[._-]+$/gu, '')
    .toLowerCase();

  if (normalized.length === 0 || WINDOWS_RESERVED_NAMES.test(normalized)) {
    return 'flowlens-workflow';
  }
  return normalized;
};

export const workflowExportFileName = (
  workflow: CanonicalWorkflow,
  format: 'svg' | 'png',
): string => `${safeWorkflowFileStem(workflow)}.${format}`;

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
};
