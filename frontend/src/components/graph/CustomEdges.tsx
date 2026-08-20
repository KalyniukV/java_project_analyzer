import React, { memo } from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';
import { EdgeHighlightState, RelationKind } from '../../types';

export const CustomGraphEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps<any>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.2,
  });

  const highlight = (data?.highlight_state as EdgeHighlightState) || 'Normal';
  const isCircular = data?.is_circular || false;
  const kind = data?.kind as RelationKind | undefined;
  const isGwtRpc = kind === 'GwtRpcCall' || kind === 'GwtRpcBinding';
  const label = data?.label as string | undefined;
  const hopDepth = data?.hop_depth as number | undefined;
  const isIndirect = hopDepth !== undefined && hopDepth >= 2;
  const isDirect = hopDepth === 1;

  // 1. Clean Baseline (Subdued when idle to prevent visual spaghetti)
  let strokeColor = isGwtRpc ? '#a855f7' : '#475569';
  let strokeWidth = 1.0;
  let opacity = 0.18;
  let strokeDasharray: string | undefined = undefined;

  // 2. Focused highlighting when a node is selected or inspected
  if (highlight === 'InboundActive') {
    if (isIndirect) {
      strokeColor = '#818cf8';
      strokeWidth = 2.0;
      opacity = 0.9;
      strokeDasharray = '5,4';
    } else {
      strokeColor = '#38bdf8'; // Clean Solid Sky Blue for Inbound
      strokeWidth = 2.5;
      opacity = 1.0;
    }
  } else if (highlight === 'OutboundActive') {
    if (isIndirect) {
      strokeColor = '#fbbf24';
      strokeWidth = 2.0;
      opacity = 0.9;
      strokeDasharray = '5,4';
    } else {
      strokeColor = '#fb923c'; // Clean Solid Orange for Outbound
      strokeWidth = 2.5;
      opacity = 1.0;
    }
  } else if (highlight === 'CircularActive') {
    strokeColor = '#ef4444'; // Red for cycles
    strokeWidth = 2.5;
    opacity = 1.0;
  } else if (highlight === 'Dimmed') {
    strokeColor = '#1e293b';
    strokeWidth = 0.5;
    opacity = 0.03; // Effectively hidden to eliminate clutter
  } else if (isCircular) {
    strokeColor = 'rgba(239, 68, 68, 0.3)';
    strokeWidth = 1.0;
    opacity = 0.3;
  }

  const isActive = highlight === 'InboundActive' || highlight === 'OutboundActive' || highlight === 'CircularActive';
  const showBadge = isActive && (isDirect || isIndirect || (label && label.length > 0));

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          opacity,
          strokeDasharray,
        }}
      />
      {showBadge && (
        <foreignObject
          width={160}
          height={26}
          x={labelX - 80}
          y={labelY - 13}
          className="pointer-events-none"
        >
          <div className="flex items-center justify-center h-full">
            <span
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border shadow-md truncate max-w-[150px] flex items-center gap-1 ${
                highlight === 'InboundActive'
                  ? 'bg-[#0b2033] border-sky-500 text-sky-200'
                  : highlight === 'OutboundActive'
                  ? 'bg-[#331c0c] border-amber-500 text-amber-200'
                  : highlight === 'CircularActive'
                  ? 'bg-[#381111] border-rose-500 text-rose-200'
                  : 'bg-[#161b22] border-[#30363d] text-slate-300'
              }`}
              title={label || `Hop: ${hopDepth}`}
            >
              {highlight === 'InboundActive' ? '⬅ in' : highlight === 'OutboundActive' ? '➡ out' : '⟳ cycle'}
              {label && <span className="truncate opacity-90">• {label}</span>}
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
});
