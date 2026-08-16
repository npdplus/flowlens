import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { FlowLensDiagnostic, InputFormat, WorkflowAnalysisResult } from '@flowlens/core';
import {
  FlowLensDiagram,
  type FlowLensDiagramError,
  type FlowLensDiagramHandle,
  type FlowLensSemanticSelection,
} from '@flowlens/react';

import {
  initialThemePreference,
  persistThemePreference,
  readWorkflowFile,
  type FlowLensThemePreference,
} from './app-utils';
import { DefinitionEditor, type DefinitionEditorHandle } from './DefinitionEditor';
import { exampleById, FLOWLENS_EXAMPLES } from './examples';
import { downloadBlob, workflowExportFileName } from './export-utils';
import { Inspector, resolveSemanticSelection } from './Inspector';
import { processWorkflowText, type WorkflowProcessingResult } from './processing';

const PROCESSING_DEBOUNCE_MS = 180;

type ExportNotice =
  | { readonly kind: 'status'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

const DiagnosticItem = ({
  diagnostic,
  onNavigate,
}: {
  readonly diagnostic: FlowLensDiagnostic;
  readonly onNavigate: (diagnostic: FlowLensDiagnostic) => void;
}) => {
  const content = (
    <>
      <div className="diagnostic-title-row">
        <span className={`severity-badge severity-${diagnostic.severity}`}>
          {diagnostic.severity.toUpperCase()}
        </span>
        <strong>{diagnostic.code}</strong>
        <span className="diagnostic-category">{diagnostic.category}</span>
      </div>
      <p>{diagnostic.message}</p>
      <div className="diagnostic-context">
        {diagnostic.path === undefined ? null : <span>Path: {diagnostic.path}</span>}
        {diagnostic.entity === undefined ? null : (
          <span>
            Entity: {diagnostic.entity.kind}
            {diagnostic.entity.id === undefined ? '' : ` ${diagnostic.entity.id}`}
          </span>
        )}
        {diagnostic.location === undefined ? null : (
          <span>
            Line {diagnostic.location.line}, column {diagnostic.location.column}
          </span>
        )}
      </div>
    </>
  );

  if (diagnostic.location !== undefined) {
    return (
      <li>
        <button
          type="button"
          className="diagnostic-card diagnostic-button"
          onClick={() => onNavigate(diagnostic)}
          aria-label={`${diagnostic.code}: ${diagnostic.message}. Go to line ${diagnostic.location?.line}.`}
        >
          {content}
        </button>
      </li>
    );
  }

  return (
    <li>
      <div className="diagnostic-card">{content}</div>
    </li>
  );
};

const DiagnosticsPanel = ({
  diagnostics,
  onNavigate,
}: {
  readonly diagnostics: readonly FlowLensDiagnostic[];
  readonly onNavigate: (diagnostic: FlowLensDiagnostic) => void;
}) => (
  <section className="panel" aria-labelledby="diagnostics-heading">
    <div className="panel-heading">
      <div>
        <p className="panel-kicker">Validation</p>
        <h2 id="diagnostics-heading">Diagnostics</h2>
      </div>
      <span className="count-pill">{diagnostics.length}</span>
    </div>
    {diagnostics.length === 0 ? (
      <p className="empty-copy">No validation diagnostics for the current definition.</p>
    ) : (
      <ul className="diagnostic-list">
        {diagnostics.map((diagnostic, index) => (
          <DiagnosticItem
            key={`${diagnostic.code}-${diagnostic.path ?? diagnostic.entity?.id ?? index}-${index}`}
            diagnostic={diagnostic}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    )}
  </section>
);

const AnalysisPanel = ({ analysis }: { readonly analysis: WorkflowAnalysisResult | undefined }) => (
  <section className="panel" aria-labelledby="analysis-heading">
    <div className="panel-heading">
      <div>
        <p className="panel-kicker">Descriptive facts</p>
        <h2 id="analysis-heading">Workflow analysis</h2>
      </div>
    </div>
    {analysis === undefined ? (
      <p className="empty-copy">Analysis becomes available after structural validation.</p>
    ) : (
      <dl className="analysis-grid">
        <div>
          <dt>Steps</dt>
          <dd>{analysis.stepCount}</dd>
        </div>
        <div>
          <dt>Transitions</dt>
          <dd>{analysis.transitionCount}</dd>
        </div>
        <div>
          <dt>Decisions</dt>
          <dd>{analysis.decisionStepCount}</dd>
        </div>
        <div>
          <dt>Entries</dt>
          <dd>{analysis.entry.candidateCount}</dd>
        </div>
        <div>
          <dt>Terminals</dt>
          <dd>{analysis.terminal.candidateCount}</dd>
        </div>
        <div>
          <dt>Cycles</dt>
          <dd>{analysis.cycles.hasDirectedCycle ? 'Present' : 'None'}</dd>
        </div>
        <div>
          <dt>Components</dt>
          <dd>{analysis.components.count}</dd>
        </div>
        <div>
          <dt>Branching steps</dt>
          <dd>{analysis.branching.stepCount}</dd>
        </div>
      </dl>
    )}
  </section>
);

const ProcessingMessage = ({ result }: { readonly result: WorkflowProcessingResult }) => {
  if (result.stage === 'empty') {
    return (
      <p className="workspace-message">Paste, edit, or open a JSON/YAML workflow definition.</p>
    );
  }
  if (result.stage === 'parse-error') {
    return <p className="workspace-message">Fix the syntax error to render the workflow.</p>;
  }
  if (result.stage === 'schema-error') {
    return (
      <p className="workspace-message">
        Fix structural diagnostics to create a canonical workflow.
      </p>
    );
  }
  if (result.stage === 'semantic-error') {
    return (
      <p className="workspace-message">
        Fix semantic errors to render the current workflow safely.
      </p>
    );
  }
  if (result.stage === 'internal-error') {
    return (
      <p className="workspace-message" role="alert">
        {result.applicationError}
      </p>
    );
  }
  return null;
};

export function App() {
  const [definitionText, setDefinitionText] = useState('');
  const [processedText, setProcessedText] = useState('');
  const [format, setFormat] = useState<InputFormat>('yaml');
  const [theme, setTheme] = useState<FlowLensThemePreference>(initialThemePreference);
  const [selection, setSelection] = useState<FlowLensSemanticSelection | null>(null);
  const [selectedExampleId, setSelectedExampleId] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [diagramError, setDiagramError] = useState<FlowLensDiagramError | null>(null);
  const [exportNotice, setExportNotice] = useState<ExportNotice | null>(null);
  const editorRef = useRef<DefinitionEditorHandle | null>(null);
  const diagramRef = useRef<FlowLensDiagramHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setProcessedText(definitionText), PROCESSING_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [definitionText]);

  useEffect(() => {
    setSelection(null);
    setDiagramError(null);
    setExportNotice(null);
  }, [definitionText, format]);

  const isProcessing = definitionText !== processedText;
  const processing = useMemo(
    () => processWorkflowText(processedText, format),
    [processedText, format],
  );
  const visibleProcessing = isProcessing ? undefined : processing;
  const diagramWorkflow = visibleProcessing?.diagramWorkflow;
  const inspectorModel = useMemo(
    () =>
      visibleProcessing?.workflow === undefined
        ? null
        : resolveSemanticSelection(visibleProcessing.workflow, selection),
    [visibleProcessing?.workflow, selection],
  );
  const exportAvailable = diagramWorkflow !== undefined && diagramError === null && !isProcessing;

  const setAndPersistTheme = (nextTheme: FlowLensThemePreference) => {
    setTheme(nextTheme);
    setExportNotice(null);
    persistThemePreference(nextTheme);
  };

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) return;
    setFileError(null);
    setSelectedExampleId('');
    const result = await readWorkflowFile(file);
    if (!result.ok) {
      setFileError(result.message);
      return;
    }
    setFormat(result.format);
    setDefinitionText(result.text);
  };

  const handleExampleSelection = (id: string) => {
    const example = exampleById(id);
    if (example === undefined) return;
    setFileError(null);
    setSelectedExampleId(example.id);
    setFormat(example.format);
    setDefinitionText(example.source);
  };

  const handleExport = async (exportFormat: 'svg' | 'png') => {
    if (!exportAvailable || diagramWorkflow === undefined) return;
    const handle = diagramRef.current;
    if (handle === null) {
      setExportNotice({ kind: 'error', message: 'FlowLens could not export the current diagram.' });
      return;
    }

    setExportNotice({
      kind: 'status',
      message: `Preparing ${exportFormat.toUpperCase()} locally…`,
    });
    const result = exportFormat === 'svg' ? await handle.exportSvg() : await handle.exportPng();
    if (!result.ok) {
      setExportNotice({ kind: 'error', message: 'FlowLens could not export the current diagram.' });
      return;
    }

    downloadBlob(result.artifact.blob, workflowExportFileName(diagramWorkflow, exportFormat));
    setExportNotice({
      kind: 'status',
      message: `${exportFormat.toUpperCase()} exported locally.`,
    });
  };

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-header">
        <div>
          <p className="eyebrow">NPD PLUS Labs · Experimental Open-source</p>
          <h1>FlowLens</h1>
          <p className="tagline">Understand. Validate. Visualize.</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setAndPersistTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? 'Dark theme' : 'Light theme'}
          </button>
        </div>
      </header>

      <div className="privacy-banner" role="note">
        <strong>Local-first.</strong> FlowLens processes workflow definitions locally in your
        browser.
      </div>

      <main className="workspace">
        <section className="panel editor-panel" aria-labelledby="definition-heading">
          <div className="panel-heading editor-toolbar">
            <div>
              <p className="panel-kicker">Definition source</p>
              <h2 id="definition-heading">Workflow definition</h2>
            </div>
            <div className="toolbar-actions">
              <label className="format-control example-control">
                <span>Example</span>
                <select
                  aria-label="Built-in workflow example"
                  value={selectedExampleId}
                  onChange={(event) => handleExampleSelection(event.target.value)}
                >
                  <option value="">Choose example…</option>
                  {FLOWLENS_EXAMPLES.map((example) => (
                    <option key={example.id} value={example.id}>
                      {example.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="format-control">
                <span>Format</span>
                <select
                  aria-label="Workflow input format"
                  value={format}
                  onChange={(event) => {
                    setSelectedExampleId('');
                    setFormat(event.target.value as InputFormat);
                  }}
                >
                  <option value="yaml">YAML</option>
                  <option value="json">JSON</option>
                </select>
              </label>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml,text/x-yaml"
                aria-label="Open workflow definition file"
                onChange={(event) => void handleFileSelection(event)}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => fileInputRef.current?.click()}
              >
                Open local file
              </button>
            </div>
          </div>
          {fileError === null ? null : (
            <p className="inline-error" role="alert">
              {fileError}
            </p>
          )}
          <DefinitionEditor
            ref={editorRef}
            value={definitionText}
            format={format}
            theme={theme}
            onChange={(value) => {
              setSelectedExampleId('');
              setDefinitionText(value);
            }}
          />
          <div className="editor-status" aria-live="polite">
            {isProcessing ? 'Processing locally…' : 'Current definition processed locally.'}
          </div>
        </section>

        <section className="panel diagram-panel" aria-labelledby="diagram-heading">
          <div className="panel-heading diagram-toolbar">
            <div>
              <p className="panel-kicker">Read-only visualization</p>
              <h2 id="diagram-heading">Diagram</h2>
            </div>
            <div className="toolbar-actions diagram-actions">
              <div className="toolbar-actions" aria-label="Diagram export controls">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!exportAvailable}
                  onClick={() => void handleExport('svg')}
                  aria-label="Export workflow diagram as SVG"
                >
                  Export SVG
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!exportAvailable}
                  onClick={() => void handleExport('png')}
                  aria-label="Export workflow diagram as PNG"
                >
                  Export PNG
                </button>
              </div>
              <div className="toolbar-actions" aria-label="Diagram viewport controls">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => void diagramRef.current?.zoomOut()}
                  aria-label="Zoom out workflow diagram"
                >
                  −
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => void diagramRef.current?.fitView()}
                  aria-label="Fit workflow diagram to view"
                >
                  Fit
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => void diagramRef.current?.zoomIn()}
                  aria-label="Zoom in workflow diagram"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          {exportNotice === null ? null : (
            <p
              className={
                exportNotice.kind === 'error' ? 'inline-error export-notice' : 'export-notice'
              }
              role={exportNotice.kind === 'error' ? 'alert' : 'status'}
            >
              {exportNotice.message}
            </p>
          )}
          <div className="diagram-stage">
            {diagramWorkflow === undefined ? (
              isProcessing ? (
                <p className="workspace-message" aria-live="polite">
                  Processing current definition locally…
                </p>
              ) : (
                <ProcessingMessage result={processing} />
              )
            ) : (
              <FlowLensDiagram
                ref={diagramRef}
                workflow={diagramWorkflow}
                theme={theme}
                onSelectionChange={setSelection}
                onError={setDiagramError}
              />
            )}
          </div>
          {diagramError === null ? null : (
            <p className="inline-error" role="alert">
              {diagramError.message}
            </p>
          )}
        </section>
      </main>

      <div className="detail-grid">
        <DiagnosticsPanel
          diagnostics={visibleProcessing?.diagnostics ?? []}
          onNavigate={(diagnostic) => {
            if (diagnostic.location !== undefined) {
              editorRef.current?.focusLocation(diagnostic.location);
            }
          }}
        />
        <AnalysisPanel analysis={visibleProcessing?.analysis} />
        <Inspector model={inspectorModel} />
      </div>
    </div>
  );
}
