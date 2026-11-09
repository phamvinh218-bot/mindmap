'use client';

import { memo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  BaseEdge, EdgeLabelRenderer, useInternalNode, useReactFlow, type Edge, type EdgeProps, type InternalNode,
} from '@xyflow/react';

type Pt = { x: number; y: number };

export interface ConnectionEdgeData extends Record<string, unknown> {
  color: string;
  /** Offset of the curve's control point from the midpoint between the two node centers. */
  control: Pt | null;
  readOnly: boolean;
  onControlChange(id: string, control: Pt): void;
}
export type ConnectionFlowEdge = Edge<ConnectionEdgeData, 'link'>;

function box(n: InternalNode) {
  const w = n.measured.width ?? 0;
  const h = n.measured.height ?? 0;
  const p = n.internals.positionAbsolute;
  return { cx: p.x + w / 2, cy: p.y + h / 2, hw: w / 2 + 4, hh: h / 2 + 4 };
}

/** Point where the ray from the box center toward `to` leaves the box. */
function clip(b: ReturnType<typeof box>, to: Pt): Pt {
  const dx = to.x - b.cx;
  const dy = to.y - b.cy;
  if (dx === 0 && dy === 0) return { x: b.cx, y: b.cy };
  const s = Math.min(dx ? b.hw / Math.abs(dx) : Infinity, dy ? b.hh / Math.abs(dy) : Infinity, 1);
  return { x: b.cx + dx * s, y: b.cy + dy * s };
}

export function defaultControl(a: Pt, b: Pt): Pt {
  // Bend sideways by 25% of the distance so the link reads as a curve, not a branch.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return { x: -dy * 0.25, y: dx * 0.25 };
}

function ConnectionEdge({ id, source, target, data, selected, markerEnd }: EdgeProps<ConnectionFlowEdge>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  const rf = useReactFlow();
  const [drag, setDrag] = useState<Pt | null>(null);
  if (!s || !t || !data) return null;

  const sb = box(s);
  const tb = box(t);
  const a = { x: sb.cx, y: sb.cy };
  const b = { x: tb.cx, y: tb.cy };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const off = drag ?? data.control ?? defaultControl(a, b);
  const q = { x: mid.x + off.x, y: mid.y + off.y };
  const p0 = clip(sb, q);
  const p2 = clip(tb, q);
  const path = `M ${p0.x},${p0.y} Q ${q.x},${q.y} ${p2.x},${p2.y}`;
  // Point on the curve at t = 0.5 — where the drag handle sits.
  const m = { x: 0.25 * p0.x + 0.5 * q.x + 0.25 * p2.x, y: 0.25 * p0.y + 0.5 * q.y + 0.25 * p2.y };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (data.readOnly) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const toOffset = (ev: { clientX: number; clientY: number }) => {
      const fp = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      // m ≈ 0.25a + 0.5q + 0.25b  ⇒  q ≈ 2m − mid  ⇒  offset = q − mid = 2(m − mid)
      return { x: 2 * (fp.x - mid.x), y: 2 * (fp.y - mid.y) };
    };
    let last = off;
    const move = (ev: PointerEvent) => {
      last = toOffset(ev);
      setDrag(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      data.onControlChange(id, { x: Math.round(last.x), y: Math.round(last.y) });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        interactionWidth={16}
        style={{ stroke: data.color, strokeWidth: selected ? 2.5 : 1.75, strokeDasharray: selected ? undefined : '0' }}
      />
      {selected && !data.readOnly && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan mm-curve-handle"
            title="Kéo để chỉnh độ cong"
            style={{ transform: `translate(-50%, -50%) translate(${m.x}px, ${m.y}px)` }}
            onPointerDown={onPointerDown}
          />
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(ConnectionEdge);
