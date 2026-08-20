import React, { memo } from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';
import { EdgeHighlightState } from '../../types';

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
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.15,
  });

  const highlight = (data?.highlight_state as EdgeHighlightState) || 'Normal';
  const isCircular = data?.is_circular || false;

  // 1. Clean, static, non-blinking lines
  let strokeColor = '#475569';
  let strokeWidth = 1.0;
  let opacity = 0.20;

  if (highlight === 'InboundActive') {
    strokeColor = '#38bdf8'; // Solid Sky Blue for Inbound
    strokeWidth = 2.5;
    opacity = 1.0;
  } else if (highlight === 'OutboundActive') {
    strokeColor = '#fb923c'; // Solid Orange for Outbound
    strokeWidth = 2.5;
    opacity = 1.0;
  } else if (highlight === 'CircularActive') {
    strokeColor = '#ef4444'; // Solid Red for Circular dependencies
    strokeWidth = 2.5;
    opacity = 1.0;
  } else if (highlight === 'Dimmed') {
    strokeColor = '#1e293b';
    strokeWidth = 0.5;
    opacity = 0.03; // Effectively hidden
  } else if (isCircular) {
    strokeColor = 'rgba(239, 68, 68, 0.35)';
    strokeWidth = 1.0;
    opacity = 0.35;
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        stroke: strokeColor,
        strokeWidth,
        opacity,
      }}
    />
  );
});
