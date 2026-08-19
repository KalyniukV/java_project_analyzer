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

  let strokeColor = isGwtRpc ? '#c084fc' : '#30363d';
  let strokeWidth = isGwtRpc ? 1.6 : 1.2;
  let opacity = isGwtRpc ? 0.65 : 0.3;
  let strokeDasharray = isGwtRpc ? '4,4' : undefined;

  if (highlight === 'InboundActive') {
    strokeColor = isGwtRpc ? '#e879f9' : '#38bdf8'; // Neon Fuchsia for RPC or Cyan
    strokeWidth = 2.8;
    opacity = 1.0;
  } else if (highlight === 'OutboundActive') {
    strokeColor = isGwtRpc ? '#d946ef' : '#fb923c'; // Neon Fuchsia for RPC or Amber
    strokeWidth = 2.8;
    opacity = 1.0;
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
  const showLabel = label && (highlight === 'InboundActive' || highlight === 'OutboundActive' || highlight === 'CircularActive' || isCircular || (isGwtRpc && highlight === 'Normal'));

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
          filter: highlight !== 'Normal' && highlight !== 'Dimmed' ? `drop-shadow(0 0 5px ${strokeColor})` : undefined,
        }}
      />
      {showLabel && (
        <foreignObject
          width={150}
          height={26}
          x={labelX - 75}
          y={labelY - 13}
          className="pointer-events-none"
        >
          <div className="flex items-center justify-center h-full">
            <span
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border shadow-xl truncate max-w-[140px] ${
                isGwtRpc
                  ? 'bg-fuchsia-950/90 border-fuchsia-500/50 text-fuchsia-200'
                  : 'bg-[#161b22]/95 border-[#30363d] text-slate-300'
              }`}
              title={label}
            >
              {label}
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
});
