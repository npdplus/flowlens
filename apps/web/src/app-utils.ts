import type { InputFormat } from '@flowlens/core';

export type FlowLensThemePreference = 'light' | 'dark';
export const FLOWLENS_THEME_KEY = 'flowlens.theme';

export const inputFormatFromFileName = (name: string): InputFormat | null => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  return null;
};

export interface WorkflowFileLike {
  readonly name: string;
  text(): Promise<string>;
}

export type WorkflowFileReadResult =
  | { readonly ok: true; readonly format: InputFormat; readonly text: string }
  | { readonly ok: false; readonly message: string };

export const readWorkflowFile = async (file: WorkflowFileLike): Promise<WorkflowFileReadResult> => {
  const format = inputFormatFromFileName(file.name);
  if (format === null) {
    return {
      ok: false,
      message: 'Unsupported file. Open a .json, .yaml, or .yml workflow definition.',
    };
  }
  try {
    return { ok: true, format, text: await file.text() };
  } catch {
    return { ok: false, message: 'FlowLens could not read the selected local file.' };
  }
};

export const initialThemePreference = (): FlowLensThemePreference => {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.localStorage.getItem(FLOWLENS_THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const persistThemePreference = (theme: FlowLensThemePreference): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FLOWLENS_THEME_KEY, theme);
  } catch {
    // Theme preference persistence is optional when browser storage is unavailable.
  }
};
