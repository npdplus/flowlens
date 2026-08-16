import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorSelection, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import type { InputFormat } from '@flowlens/core';

import type { FlowLensThemePreference } from './app-utils';

export interface EditorSourceLocation {
  readonly line: number;
  readonly column: number;
}

export interface DefinitionEditorHandle {
  focusLocation(location: EditorSourceLocation): void;
  focus(): void;
}

export interface DefinitionEditorProps {
  readonly value: string;
  readonly format: InputFormat;
  readonly theme: FlowLensThemePreference;
  readonly onChange: (value: string) => void;
}

const languageExtension = (format: InputFormat): Extension => (format === 'json' ? json() : yaml());

const editorTheme = (theme: FlowLensThemePreference): Extension =>
  EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: 'var(--editor-bg)',
        color: 'var(--text-primary)',
      },
      '.cm-scroller': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        lineHeight: '1.55',
      },
      '.cm-content': { minHeight: '28rem', caretColor: 'var(--accent)' },
      '.cm-gutters': {
        backgroundColor: 'var(--editor-gutter)',
        color: 'var(--text-muted)',
        borderRight: '1px solid var(--border)',
      },
      '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--editor-active)' },
      '&.cm-focused': { outline: '2px solid var(--focus)', outlineOffset: '-2px' },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--editor-selection) !important',
      },
    },
    { dark: theme === 'dark' },
  );

export const DefinitionEditor = forwardRef<DefinitionEditorHandle, DefinitionEditorProps>(
  function DefinitionEditor({ value, format, theme, onChange }, ref) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const languageCompartmentRef = useRef(new Compartment());
    const themeCompartmentRef = useRef(new Compartment());

    onChangeRef.current = onChange;

    useEffect(() => {
      const host = hostRef.current;
      if (host === null) return;

      const state = EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            'aria-label': 'Workflow definition editor',
            'aria-multiline': 'true',
          }),
          languageCompartmentRef.current.of(languageExtension(format)),
          themeCompartmentRef.current.of(editorTheme(theme)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      });

      const view = new EditorView({ state, parent: host });
      viewRef.current = view;
      return () => {
        viewRef.current = null;
        view.destroy();
      };
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (view === null || view.state.doc.toString() === value) return;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }, [value]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: languageCompartmentRef.current.reconfigure(languageExtension(format)),
      });
    }, [format]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: themeCompartmentRef.current.reconfigure(editorTheme(theme)),
      });
    }, [theme]);

    useImperativeHandle(
      ref,
      () => ({
        focus() {
          viewRef.current?.focus();
        },
        focusLocation(location) {
          const view = viewRef.current;
          if (view === null || view.state.doc.lines === 0) return;
          const lineNumber = Math.max(1, Math.min(location.line, view.state.doc.lines));
          const line = view.state.doc.line(lineNumber);
          const columnOffset = Math.max(0, Math.min(location.column - 1, line.length));
          const position = line.from + columnOffset;
          view.dispatch({
            selection: EditorSelection.cursor(position),
            scrollIntoView: true,
          });
          view.focus();
        },
      }),
      [],
    );

    return <div className="definition-editor" ref={hostRef} data-input-format={format} />;
  },
);
