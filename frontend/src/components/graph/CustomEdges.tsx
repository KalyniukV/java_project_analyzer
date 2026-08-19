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

  let strokeColor = isGwtRpc ? '#c084fc' : '#30363d';
  let strokeWidth = isGwtRpc ? 1.6 : 1.2;
  let opacity = isGwtRpc ? 0.65 : 0.3;
  let strokeDasharray: string | undefined = isGwtRpc ? '4,4' : undefined;

  if (highlight === 'InboundActive') {
    if (isIndirect) {
      // Indirect Inbound (Hop >= 2) -> Indigo / Violet dashed
      strokeColor = '#818cf8';
      strokeWidth = 2.0;
      opacity = 0.85;
      strokeDasharray = '6,4';
    } else {
      // Direct Inbound (Hop 1) -> Solid Bright Cyan
      strokeColor = isGwtRpc ? '#e879f9' : '#38bdf8';
      strokeWidth = 3.0;
      opacity = 1.0;
      strokeDasharray = isGwtRpc ? '4,4' : undefined;
    }
  } else if (highlight === 'OutboundActive') {
    if (isIndirect) {
      // Indirect Outbound (Hop >= 2) -> Warm Amber dashed
      strokeColor = '#fbbf24';
      strokeWidth = 2.0;
      opacity = 0.85;
      strokeDasharray = '6,4';
    } else {
      // Direct Outbound (Hop 1) -> Solid Bright Orange/Amber
      strokeColor = isGwtRpc ? '#d946ef' : '#fb923c';
      strokeWidth = 3.0;
      opacity = 1.0;
      strokeDasharray = isGwtRpc ? '4,4' : undefined;
    }
  } else if (highlight === 'CircularActive' || isCircular) {
    strokeColor = '#ef4444'; // Red
    strokeWidth = 3;
    opacity = 1.0;
  } else if (highlight === 'Dimmed') {
    strokeColor = '#21262d';
    strokeWidth = 0.8;
    opacity = 0.08;
  }

  // Show text label on edge only when active or hovered or for GWT RPC to prevent visual noise
  const showLabel =
    (label || isIndirect) &&
    (highlight === 'InboundActive' ||
      highlight === 'OutboundActive' ||
      highlight === 'CircularActive' ||
      isCircular ||
      (isGwtRpc && highlight === 'Normal'));

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
          transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
          filter:
            highlight !== 'Normal' && highlight !== 'Dimmed'
              ? `drop-shadow(0 0 ${isIndirect ? '3px' : '6px'} ${strokeColor})`
              : undefined,
        }}
      />
      {showLabel && (
        <foreignObject
          width={160}
          height={26}
          x={labelX - 80}
          y={labelY - 13}
          className="pointer-events-none"
        >
          <div className="flex items-center justify-center h-full">
            <span
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border shadow-xl truncate max-w-[150px] flex items-center gap-1 ${
                isIndirect
                  ? 'bg-indigo-950/90 border-indigo-500/50 text-indigo-200'
                  : isGwtRpc
                  ? 'bg-fuchsia-950/90 border-fuchsia-500/50 text-fuchsia-200'
                  : 'bg-[#161b22]/95 border-[#30363d] text-slate-300'
              }`}
              title={label || (isIndirect ? `Глибина зв'язку: Hop ${hopDepth}` : undefined)}
            >
              {isIndirect && (
                <span className="text-[8px] px-1 py-0.1 rounded bg-indigo-500/30 text-indigo-300">
                  Hop {hopDepth}
                </span>
              )}
              <span>{label || 'transitive'}</span>
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
});
