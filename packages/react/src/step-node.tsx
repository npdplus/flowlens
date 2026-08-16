import { Handle, Position, type NodeProps } from '@xyflow/react';

import { getStepTypeLabel } from './mapping';
import type { FlowLensStepNode, FlowLensStepNodeData } from './types';

export function FlowLensStepContent({ data }: { readonly data: FlowLensStepNodeData }) {
  return (
    <div className="flowlens-step__content">
      <div className="flowlens-step__header">
        <span className="flowlens-step__type">{getStepTypeLabel(data.stepType)}</span>
        <span
          className="flowlens-step__status"
          aria-label={`Status: ${data.statusLabel}`}
          title={`Status: ${data.statusLabel}`}
        >
          <span className="flowlens-step__status-symbol" aria-hidden="true">
            {data.statusSymbol}
          </span>
          <span>{data.statusLabel}</span>
        </span>
      </div>
      <div className="flowlens-step__label">{data.label}</div>
      {data.description === undefined ? null : (
        <div className="flowlens-step__description">{data.description}</div>
      )}
    </div>
  );
}

export function FlowLensStepNodeComponent({ data, selected }: NodeProps<FlowLensStepNode>) {
  return (
    <div className={selected ? 'flowlens-step__frame is-selected' : 'flowlens-step__frame'}>
      <Handle
        id="target"
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="flowlens-step__handle"
      />
      <FlowLensStepContent data={data} />
      <Handle
        id="source"
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="flowlens-step__handle"
      />
    </div>
  );
}
