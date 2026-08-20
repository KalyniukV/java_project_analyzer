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
    curvature: 0.25,
  });

  const highlight = (data?.highlight_state as EdgeHighlightState) || 'Normal';
  const isCircular = data?.is_circular || false;
  const kind = data?.kind as RelationKind | undefined;
  const isGwtRpc = kind === 'GwtRpcCall' || kind === 'GwtRpcBinding';
  const label = data?.label as string | undefined;
  const hopDepth = data?.hop_depth as number | undefined;
  const isIndirect = hopDepth !== undefined && hopDepth >= 2;
  const isDirect = hopDepth === 1;

  // 1. Base Default Styling (Clean, Lightweight, Subtle Background)
  let strokeColor = isGwtRpc ? '#a855f7' : '#30363d';
  let strokeWidth = 1.0;
  let opacity = 0.22;
  let strokeDasharray: string | undefined = isGwtRpc ? '4,4' : undefined;

  // 2. Active Highlighting when Node is Selected
  if (highlight === 'InboundActive') {
    if (isIndirect) {
      strokeColor = '#a78bfa'; // Violet/Indigo dashed
      strokeWidth = 2.0;
      opacity = 0.9;
      strokeDasharray = '6,4';
    } else {
      strokeColor = isGwtRpc ? '#e879f9' : '#38bdf8'; // Glowing Bright Cyan
      strokeWidth = 3.0;
      opacity = 1.0;
      strokeDasharray = isGwtRpc ? '4,4' : undefined;
    }
  } else if (highlight === 'OutboundActive') {
    if (isIndirect) {
      strokeColor = '#fbbf24'; // Warm Amber dashed
      strokeWidth = 2.0;
      opacity = 0.9;
      strokeDasharray = '6,4';
    } else {
      strokeColor = isGwtRpc ? '#d946ef' : '#fb923c'; // Glowing Bright Orange
      strokeWidth = 3.0;
      opacity = 1.0;
      strokeDasharray = isGwtRpc ? '4,4' : undefined;
    }
  } else if (highlight === 'CircularActive') {
    // Only solid bright red when an active cycle is SELECTED
    strokeColor = '#ef4444';
    strokeWidth = 3.0;
    opacity = 1.0;
  } else if (highlight === 'Dimmed') {
    strokeColor = '#21262d';
    strokeWidth = 0.6;
    opacity = 0.05;
  } else if (isCircular) {
    // Unselected circular edge: subtle muted hint without cluttering the screen
    strokeColor = 'rgba(239, 68, 68, 0.35)';
    strokeWidth = 1.2;
    opacity = 0.35;
  }

  // Only render label badges for ACTIVE selected edges to maintain 60 FPS
  const isActive = highlight === 'InboundActive' || highlight === 'OutboundActive' || highlight === 'CircularActive';
  const showLabel = isActive && (isDirect || isIndirect || (label && label.length > 0));

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
      {showLabel && (
        <foreignObject
          width={150}
          height={24}
          x={labelX - 75}
          y={labelY - 12}
          className="pointer-events-none"
        >
          <div className="flex items-center justify-center h-full">
            <span
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border shadow-lg truncate max-w-[140px] flex items-center gap-1 backdrop-blur-md ${
                highlight === 'CircularActive'
                  ? 'bg-rose-950/95 border-rose-500 text-rose-200'
                  : isIndirect
                  ? 'bg-indigo-950/95 border-indigo-400 text-indigo-200'
                  : isDirect
                  ? 'bg-[#0d1117]/95 border-sky-400 text-sky-200'
                  : 'bg-[#161b22]/95 border-[#30363d] text-slate-300'
              }`}
              title={label || `Hop: ${hopDepth}`}
            >
              {isIndirect ? (
                <span className="text-[8px] px-1 py-0.1 rounded bg-indigo-500/40 text-indigo-200 font-bold">
                  Hop {hopDepth}
                </span>
              ) : isDirect ? (
                <span className="text-[8px] px-1 py-0.1 rounded bg-sky-500/30 text-sky-200 font-bold">
                  Hop 1
                </span>
              ) : null}
              <span className="truncate">{label || (isIndirect ? 'transitive' : 'direct')}</span>
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
});
