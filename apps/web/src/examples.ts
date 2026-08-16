import type { InputFormat } from '@flowlens/core';

import aiAgentWorkflow from '../../../examples/ai-agent-workflow.yaml?raw';
import ciCdDeployment from '../../../examples/ci-cd-deployment.yaml?raw';
import incidentResponse from '../../../examples/incident-response.yaml?raw';
import purchaseApproval from '../../../examples/purchase-approval.yaml?raw';
import simpleSequential from '../../../examples/simple-sequential.yaml?raw';

export interface FlowLensExample {
  readonly id: string;
  readonly label: string;
  readonly format: InputFormat;
  readonly source: string;
}

export const FLOWLENS_EXAMPLES: readonly FlowLensExample[] = Object.freeze([
  {
    id: 'simple-sequential',
    label: 'Simple Sequential Workflow',
    format: 'yaml',
    source: simpleSequential,
  },
  { id: 'purchase-approval', label: 'Purchase Approval', format: 'yaml', source: purchaseApproval },
  { id: 'ci-cd-deployment', label: 'CI/CD Deployment', format: 'yaml', source: ciCdDeployment },
  { id: 'ai-agent-workflow', label: 'AI Agent Workflow', format: 'yaml', source: aiAgentWorkflow },
  { id: 'incident-response', label: 'Incident Response', format: 'yaml', source: incidentResponse },
]);

export const exampleById = (id: string): FlowLensExample | undefined =>
  FLOWLENS_EXAMPLES.find((example) => example.id === id);
