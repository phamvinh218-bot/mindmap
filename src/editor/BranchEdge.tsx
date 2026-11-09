'use client';

import { memo } from 'react';
import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';

export type BranchFlowEdge = Edge<{ color: string; depth: number }, 'branch'>;

function BranchEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<BranchFlowEdge>) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.4 });
  const width = data?.depth === 1 ? 3 : 2;
  return <BaseEdge path={path} style={{ stroke: data?.color, strokeWidth: width, strokeLinecap: 'round' }} />;
}

export default memo(BranchEdge);
