import type { DiagnosticEntity } from '../diagnostics/diagnostic';
import { collectWeaklyConnectedStepIdComponents } from '../graph/weak-components';
import {
  buildWorkflowGraphIndex,
  type IndexedCanonicalStep,
  type IndexedCanonicalTransition,
  type WorkflowGraphIndex,
} from '../graph/workflow-graph-index';
import type { CanonicalWorkflow, StepId } from '../model/workflow';
import type {
  P05AnalysisDiagnostic,
  SemanticDiagnostic,
  SemanticValidationDiagnostic,
} from './semantic-diagnostic';

export interface SemanticValidationResult {
  readonly diagnostics: readonly SemanticValidationDiagnostic[];
  readonly isValid: boolean;
  readonly hasErrors: boolean;
  readonly hasWarnings: boolean;
}

type DiagnosticStage = 0 | 1 | 2;
type DiagnosticCollection = 0 | 1 | 2;

interface DiagnosticCandidate {
  readonly diagnostic: SemanticValidationDiagnostic;
  readonly stage: DiagnosticStage;
  readonly collection: DiagnosticCollection;
  readonly index: number;
  readonly fieldOrder: number;
  readonly sequence: number;
}

const compareStrings = (left: string, right: string): number => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const sortDiagnostics = (
  candidates: readonly DiagnosticCandidate[],
): readonly SemanticValidationDiagnostic[] =>
  [...candidates]
    .sort((left, right) => {
      if (left.stage !== right.stage) return left.stage - right.stage;
      if (left.collection !== right.collection) return left.collection - right.collection;
      if (left.index !== right.index) return left.index - right.index;
      if (left.fieldOrder !== right.fieldOrder) return left.fieldOrder - right.fieldOrder;
      const codeComparison = compareStrings(left.diagnostic.code, right.diagnostic.code);
      return codeComparison !== 0 ? codeComparison : left.sequence - right.sequence;
    })
    .map(({ diagnostic }) => diagnostic);

const safeIdentifier = (identifier: string): string => {
  const compact = identifier.replace(/[\r\n\t]/gu, ' ');
  return compact.length <= 80 ? compact : `${compact.slice(0, 77)}...`;
};

const quotedIdentifier = (identifier: string): string => JSON.stringify(safeIdentifier(identifier));

const workflowEntity = (workflow: CanonicalWorkflow): DiagnosticEntity => ({
  kind: 'workflow',
  ...(workflow.id === undefined ? {} : { id: workflow.id }),
});

const stepEntity = ({ step, index }: IndexedCanonicalStep): DiagnosticEntity => ({
  kind: 'step',
  id: step.id,
  index,
});

const transitionEntity = ({ transition, index }: IndexedCanonicalTransition): DiagnosticEntity => ({
  kind: 'transition',
  ...(transition.sourceDefinedId === undefined ? {} : { id: transition.sourceDefinedId }),
  index,
});

const semanticDiagnostic = (
  code: SemanticDiagnostic['code'],
  severity: SemanticDiagnostic['severity'],
  message: string,
  path: string,
  entity: DiagnosticEntity,
  details?: SemanticDiagnostic['details'],
): SemanticDiagnostic => ({
  code,
  severity,
  category: 'semantic',
  message,
  path,
  entity,
  ...(details === undefined ? {} : { details }),
});

const analysisDiagnostic = (
  code: P05AnalysisDiagnostic['code'],
  message: string,
  path: string,
  entity: DiagnosticEntity,
): P05AnalysisDiagnostic => ({
  code,
  severity: 'info',
  category: 'analysis',
  message,
  path,
  entity,
});

const uniqueIndexedSteps = (
  steps: readonly IndexedCanonicalStep[],
): readonly IndexedCanonicalStep[] => {
  const seen = new Set<StepId>();
  const result: IndexedCanonicalStep[] = [];
  for (const indexedStep of steps) {
    if (seen.has(indexedStep.step.id)) continue;
    seen.add(indexedStep.step.id);
    result.push(indexedStep);
  }
  return result;
};

const selectReachabilityRoots = (graph: WorkflowGraphIndex): readonly IndexedCanonicalStep[] => {
  if (graph.explicitStartSteps.length > 0) {
    return uniqueIndexedSteps(graph.explicitStartSteps);
  }

  const entries = uniqueIndexedSteps(graph.entryCandidates);
  if (entries.length > 0) {
    return entries;
  }

  const first = graph.steps[0];
  return first === undefined ? [] : [first];
};

const collectReachableStepIds = (
  graph: WorkflowGraphIndex,
  roots: readonly IndexedCanonicalStep[],
): ReadonlySet<StepId> => {
  const visited = new Set<StepId>();
  const queue: StepId[] = roots.map(({ step }) => step.id);
  let cursor = 0;

  while (cursor < queue.length) {
    const stepId = queue[cursor];
    cursor += 1;
    if (stepId === undefined || visited.has(stepId)) continue;
    visited.add(stepId);

    for (const { transition } of graph.validOutgoingTransitionsByStepId.get(stepId) ?? []) {
      if (!visited.has(transition.targetStepId)) {
        queue.push(transition.targetStepId);
      }
    }
  }

  return visited;
};

const hasNonSelfCycle = (graph: WorkflowGraphIndex): boolean => {
  const stepIds = [...graph.stepById.keys()];
  const indegree = new Map<StepId, number>(stepIds.map((stepId) => [stepId, 0]));
  const outgoing = new Map<StepId, StepId[]>();

  for (const { transition } of graph.validTransitions) {
    if (transition.sourceStepId === transition.targetStepId) continue;
    const targets = outgoing.get(transition.sourceStepId);
    if (targets === undefined) {
      outgoing.set(transition.sourceStepId, [transition.targetStepId]);
    } else {
      targets.push(transition.targetStepId);
    }
    indegree.set(transition.targetStepId, (indegree.get(transition.targetStepId) ?? 0) + 1);
  }

  const queue = stepIds.filter((stepId) => (indegree.get(stepId) ?? 0) === 0);
  let cursor = 0;
  let processed = 0;
  while (cursor < queue.length) {
    const stepId = queue[cursor];
    cursor += 1;
    if (stepId === undefined) continue;
    processed += 1;
    for (const targetStepId of outgoing.get(stepId) ?? []) {
      const nextIndegree = (indegree.get(targetStepId) ?? 0) - 1;
      indegree.set(targetStepId, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(targetStepId);
      }
    }
  }

  return processed < stepIds.length;
};

/**
 * Validate semantic identity, references, and P05 topology rules for a canonical workflow.
 * The workflow is treated as immutable input; diagnostics and graph indexes are derived outputs only.
 */
export const validateWorkflowSemantics = (
  workflow: CanonicalWorkflow,
): SemanticValidationResult => {
  const graph = buildWorkflowGraphIndex(workflow);
  const candidates: DiagnosticCandidate[] = [];
  let sequence = 0;
  const add = (
    diagnostic: SemanticValidationDiagnostic,
    stage: DiagnosticStage,
    collection: DiagnosticCollection,
    index: number,
    fieldOrder: number,
  ): void => {
    candidates.push({ diagnostic, stage, collection, index, fieldOrder, sequence });
    sequence += 1;
  };

  const firstStepIndexById = new Map<StepId, number>();
  for (const indexedStep of graph.steps) {
    const firstIndex = firstStepIndexById.get(indexedStep.step.id);
    if (firstIndex === undefined) {
      firstStepIndexById.set(indexedStep.step.id, indexedStep.index);
      continue;
    }
    add(
      semanticDiagnostic(
        'FL2001',
        'error',
        `Duplicate step ID ${quotedIdentifier(indexedStep.step.id)}. Step IDs are case-sensitive and must be unique.`,
        `steps[${indexedStep.index}].id`,
        stepEntity(indexedStep),
        { firstIndex },
      ),
      0,
      1,
      indexedStep.index,
      0,
    );
  }

  const firstTransitionIndexBySourceId = new Map<string, number>();
  for (const indexedTransition of graph.transitions) {
    const { transition, index } = indexedTransition;

    if (transition.sourceDefinedId !== undefined) {
      const firstIndex = firstTransitionIndexBySourceId.get(transition.sourceDefinedId);
      if (firstIndex === undefined) {
        firstTransitionIndexBySourceId.set(transition.sourceDefinedId, index);
      } else {
        add(
          semanticDiagnostic(
            'FL2004',
            'error',
            `Duplicate source-defined transition ID ${quotedIdentifier(transition.sourceDefinedId)}.`,
            `transitions[${index}].id`,
            transitionEntity(indexedTransition),
            { firstIndex },
          ),
          0,
          2,
          index,
          0,
        );
      }
    }

    if (!graph.stepById.has(transition.sourceStepId)) {
      add(
        semanticDiagnostic(
          'FL2002',
          'error',
          `Transition source ${quotedIdentifier(transition.sourceStepId)} does not reference an existing step.`,
          `transitions[${index}].source`,
          transitionEntity(indexedTransition),
        ),
        0,
        2,
        index,
        1,
      );
    }

    if (!graph.stepById.has(transition.targetStepId)) {
      add(
        semanticDiagnostic(
          'FL2003',
          'error',
          `Transition target ${quotedIdentifier(transition.targetStepId)} does not reference an existing step.`,
          `transitions[${index}].target`,
          transitionEntity(indexedTransition),
        ),
        0,
        2,
        index,
        2,
      );
    }
  }

  const entryCandidates = uniqueIndexedSteps(graph.entryCandidates);
  if (entryCandidates.length === 0) {
    add(
      semanticDiagnostic(
        'FL2106',
        'warning',
        'Workflow has no topological entry candidate with zero incoming valid transitions.',
        'steps',
        workflowEntity(workflow),
      ),
      1,
      0,
      0,
      0,
    );
  } else if (entryCandidates.length > 1) {
    add(
      semanticDiagnostic(
        'FL2107',
        'info',
        'Workflow has multiple topological entry candidates.',
        'steps',
        workflowEntity(workflow),
        { entryCount: entryCandidates.length },
      ),
      1,
      0,
      0,
      1,
    );
  }

  if (graph.explicitStartSteps.length > 1) {
    add(
      semanticDiagnostic(
        'FL2108',
        'info',
        'Workflow declares multiple start steps.',
        'steps',
        workflowEntity(workflow),
        { declaredStartCount: graph.explicitStartSteps.length },
      ),
      1,
      0,
      0,
      2,
    );
  }

  const reachabilityRoots = selectReachabilityRoots(graph);
  const reachableStepIds = collectReachableStepIds(graph, reachabilityRoots);
  const unreachableStepIds = new Set<StepId>();

  for (const indexedStep of graph.steps) {
    const authoredIncoming = graph.incomingTransitionsByStepId.get(indexedStep.step.id) ?? [];
    const authoredOutgoing = graph.outgoingTransitionsByStepId.get(indexedStep.step.id) ?? [];

    if (indexedStep.step.type === 'start' && authoredIncoming.length > 0) {
      add(
        semanticDiagnostic(
          'FL2101',
          'warning',
          'Declared start step has an incoming transition.',
          `steps[${indexedStep.index}].type`,
          stepEntity(indexedStep),
        ),
        1,
        1,
        indexedStep.index,
        0,
      );
    }

    if (indexedStep.step.type === 'end' && authoredOutgoing.length > 0) {
      add(
        semanticDiagnostic(
          'FL2102',
          'warning',
          'Declared end step has an outgoing transition.',
          `steps[${indexedStep.index}].type`,
          stepEntity(indexedStep),
        ),
        1,
        1,
        indexedStep.index,
        1,
      );
    }

    if (!reachableStepIds.has(indexedStep.step.id)) {
      unreachableStepIds.add(indexedStep.step.id);
      add(
        semanticDiagnostic(
          'FL2103',
          'warning',
          'Step is unreachable from the selected declared/discovered entry basis.',
          `steps[${indexedStep.index}]`,
          stepEntity(indexedStep),
        ),
        1,
        1,
        indexedStep.index,
        2,
      );
    }

    if (
      workflow.steps.length > 1 &&
      indexedStep.step.type !== 'end' &&
      authoredOutgoing.length === 0
    ) {
      add(
        semanticDiagnostic(
          'FL2104',
          'warning',
          'Non-end step has no outgoing transition.',
          `steps[${indexedStep.index}]`,
          stepEntity(indexedStep),
        ),
        1,
        1,
        indexedStep.index,
        3,
      );
    }

    if (indexedStep.step.type === 'decision' && authoredOutgoing.length < 2) {
      add(
        semanticDiagnostic(
          'FL2105',
          'warning',
          'Decision step has fewer than two outgoing transitions.',
          `steps[${indexedStep.index}].type`,
          stepEntity(indexedStep),
          { outgoingCount: authoredOutgoing.length },
        ),
        1,
        1,
        indexedStep.index,
        4,
      );
    }
  }

  const components = collectWeaklyConnectedStepIdComponents(graph);
  const principalRootId = reachabilityRoots[0]?.step.id ?? graph.steps[0]?.step.id;
  const principalComponentIndex =
    principalRootId === undefined
      ? -1
      : components.findIndex((component) => component.includes(principalRootId));

  components.forEach((component, componentIndex) => {
    if (componentIndex === principalComponentIndex) return;
    if (component.every((stepId) => unreachableStepIds.has(stepId))) return;
    const representativeId = component[0];
    if (representativeId === undefined) return;
    const representative = graph.stepById.get(representativeId);
    if (representative === undefined) return;

    add(
      semanticDiagnostic(
        'FL2109',
        'warning',
        'Step belongs to a disconnected workflow component.',
        `steps[${representative.index}]`,
        stepEntity(representative),
      ),
      1,
      1,
      representative.index,
      5,
    );
  });

  if (hasNonSelfCycle(graph)) {
    add(
      analysisDiagnostic(
        'FL3001',
        'Workflow contains a cycle.',
        'transitions',
        workflowEntity(workflow),
      ),
      2,
      0,
      0,
      0,
    );
  }

  for (const indexedTransition of graph.validTransitions) {
    if (indexedTransition.transition.sourceStepId !== indexedTransition.transition.targetStepId) {
      continue;
    }
    add(
      analysisDiagnostic(
        'FL3002',
        'Transition forms a self-loop.',
        `transitions[${indexedTransition.index}]`,
        transitionEntity(indexedTransition),
      ),
      2,
      2,
      indexedTransition.index,
      0,
    );
  }

  const diagnostics = sortDiagnostics(candidates);
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === 'error');
  const hasWarnings = diagnostics.some((diagnostic) => diagnostic.severity === 'warning');

  return {
    diagnostics,
    isValid: !hasErrors,
    hasErrors,
    hasWarnings,
  };
};
