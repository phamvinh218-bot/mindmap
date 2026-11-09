'use client';

import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background, BackgroundVariant, ConnectionMode, MarkerType, ReactFlow, applyNodeChanges, useReactFlow,
  type Connection as RFConnection, type Edge, type EdgeChange, type NodeChange, type OnSelectionChangeParams,
} from '@xyflow/react';
import type { MapData, MindNode } from '@/lib/types';
import { addConnection, descendantIds, getNode, moveSubtree, reparent, updateConnection } from '@/lib/tree';
import { H_GAP, placeNewChild } from '@/lib/layout';
import { loadViewerState, updateViewerState } from '@/lib/viewerState';
import MindNodeView, { type MindFlowNode, type NodeActions } from './MindNodeView';
import BranchEdge, { type BranchFlowEdge } from './BranchEdge';
import ConnectionEdge, { type ConnectionFlowEdge } from './ConnectionEdge';
import type { EditorStore } from './store';

const nodeTypes = { mind: MindNodeView };
const edgeTypes = { branch: BranchEdge, link: ConnectionEdge };

function depthOf(d: MapData, n: MindNode): number {
  let depth = 0;
  let cur: MindNode | undefined = n;
  while (cur && cur.parentId !== null) {
    depth++;
    cur = getNode(d, cur.parentId);
  }
  return depth;
}

function hiddenIds(d: MapData, collapsed: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const id of collapsed) for (const x of descendantIds(d, id)) out.add(x);
  return out;
}

export function Canvas({
  store,
  mapKey,
  linkInfo,
  actions,
  connectFrom,
  onConnectPick,
}: {
  store: EditorStore;
  mapKey: string;
  linkInfo: (n: MindNode) => { title: string | null; dead: boolean } | null;
  actions: NodeActions;
  connectFrom: string | null;
  onConnectPick: (targetId: string) => void;
}) {
  const data = store((s) => s.data);
  const readOnly = store((s) => s.readOnly);
  const collapsed = store((s) => s.collapsed);
  const editingNodeId = store((s) => s.editingNodeId);
  const selectionStamp = store((s) => s.selectionStamp);
  const selectedEdgeIds = store((s) => s.selectedEdgeIds);
  const rf = useReactFlow();

  const derived = useMemo(() => {
    const hidden = hiddenIds(data, collapsed);
    const childCount = new Map<string, number>();
    for (const n of data.nodes) if (n.parentId) childCount.set(n.parentId, (childCount.get(n.parentId) ?? 0) + 1);
    const nodes: MindFlowNode[] = data.nodes.map((n) => ({
      id: n.id,
      type: 'mind',
      position: { x: n.x, y: n.y },
      hidden: hidden.has(n.id),
      draggable: !readOnly,
      zIndex: n.parentId === null ? 2 : 1,
      data: {
        node: n,
        isRoot: n.parentId === null,
        editing: editingNodeId === n.id,
        readOnly,
        childCount: childCount.get(n.id) ?? 0,
        collapsed: collapsed.has(n.id),
        link: linkInfo(n),
        connecting: connectFrom !== null && connectFrom !== n.id,
        actions,
      },
    }));
    const esel = new Set(selectedEdgeIds);
    const branches: BranchFlowEdge[] = data.nodes
      .filter((n) => n.parentId !== null)
      .map((n) => {
        const left = n.side === 'left';
        return {
          id: `b-${n.id}`,
          type: 'branch',
          source: n.parentId!,
          target: n.id,
          sourceHandle: left ? 'ls' : 'rs',
          targetHandle: left ? 'rt' : 'lt',
          selectable: false,
          focusable: false,
          data: { color: n.color, depth: depthOf(data, n) },
        };
      });
    const links: ConnectionFlowEdge[] = data.edges.map((e) => ({
      id: e.id,
      type: 'link',
      source: e.from,
      target: e.to,
      sourceHandle: 'c0',
      targetHandle: 'ct',
      selected: esel.has(e.id),
      markerEnd: { type: MarkerType.ArrowClosed, color: e.color, width: 18, height: 18 },
      data: {
        color: e.color,
        control: e.control ?? null,
        readOnly,
        onControlChange: (id, control) => store.getState().apply((d) => updateConnection(d, id, { control })),
      },
    }));
    return { nodes, edges: [...branches, ...links] as Edge[] };
  }, [data, collapsed, editingNodeId, selectedEdgeIds, readOnly, linkInfo, actions, connectFrom, store]);

  // React Flow owns measured sizes, live drag positions and node selection; the store owns the
  // map. Node selection flows canvas → store (syncSelection) except when code selects something
  // (store.select bumps selectionStamp), which is then pushed down here.
  const [nodes, setNodes] = useState<MindFlowNode[]>(derived.nodes);
  const appliedStamp = useRef(-1);
  useEffect(() => {
    const pushSelection = appliedStamp.current !== selectionStamp;
    appliedStamp.current = selectionStamp;
    const sel = new Set(store.getState().selectedNodeIds);
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      return derived.nodes.map((n) => {
        const old = byId.get(n.id);
        const selected = pushSelection ? sel.has(n.id) : !!old?.selected;
        return { ...n, selected, ...(old?.measured ? { measured: old.measured } : {}) };
      });
    });
  }, [derived.nodes, selectionStamp, store]);

  const onNodesChange = useCallback((changes: NodeChange<MindFlowNode>[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
  }, []);

  const onSelectionChange = useCallback(
    ({ nodes: ns, edges: es }: OnSelectionChangeParams) => {
      store.getState().syncSelection(
        ns.map((n) => n.id),
        es.filter((e) => e.type === 'link').map((e) => e.id),
      );
    },
    [store],
  );

  // Edges are fully controlled: apply edge (de)selection to the store, which feeds it back.
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const s = store.getState();
      const sel = new Set(s.selectedEdgeIds);
      let touched = false;
      for (const c of changes) {
        if (c.type !== 'select') continue;
        touched = true;
        if (c.selected) sel.add(c.id);
        else sel.delete(c.id);
      }
      if (touched) s.syncSelection(s.selectedNodeIds, [...sel]);
    },
    [store],
  );

  // --- Dragging: subtree follows; dropping onto another node reparents. ---
  const dragRef = useRef<{ start: Map<string, { x: number; y: number }>; moving: Set<string>; roots: string[] } | null>(null);

  const onNodeDragStart = useCallback(
    (_: unknown, _node: MindFlowNode, dragged: MindFlowNode[]) => {
      const d = store.getState().data;
      const draggedIds = new Set(dragged.map((n) => n.id));
      const moving = new Set(draggedIds);
      for (const id of draggedIds) for (const x of descendantIds(d, id)) moving.add(x);
      // top-level dragged nodes: not inside another dragged node's subtree
      const roots = [...draggedIds].filter((id) => ![...draggedIds].some((o) => o !== id && descendantIds(d, o).has(id)));
      dragRef.current = { start: new Map(d.nodes.map((n) => [n.id, { x: n.x, y: n.y }])), moving, roots };
    },
    [store],
  );

  const onNodeDrag = useCallback((_: unknown, node: MindFlowNode) => {
    const st = dragRef.current;
    if (!st) return;
    const s0 = st.start.get(node.id)!;
    const dx = node.position.x - s0.x;
    const dy = node.position.y - s0.y;
    setNodes((ns) =>
      ns.map((n) => {
        if (!st.moving.has(n.id) || n.dragging) return n;
        const p = st.start.get(n.id)!;
        return { ...n, position: { x: p.x + dx, y: p.y + dy } };
      }),
    );
  }, []);

  const onNodeDragStop = useCallback(
    (_: unknown, node: MindFlowNode) => {
      const st = dragRef.current;
      dragRef.current = null;
      if (!st) return;
      const s0 = st.start.get(node.id)!;
      const dx = node.position.x - s0.x;
      const dy = node.position.y - s0.y;
      const state = store.getState();
      const d = state.data;

      if (st.roots.length === 1) {
        const target = rf
          .getIntersectingNodes(node)
          .find((n) => !st.moving.has(n.id) && !n.hidden);
        const self = getNode(d, node.id);
        if (target && self && self.parentId !== null && self.parentId !== target.id) {
          state.apply((cur) => {
            const n0 = getNode(cur, node.id)!;
            // reparent decides the side from the node's (dropped) x position
            const dropped = moveSubtree(cur, node.id, dx, dy);
            const moved = reparent(dropped, node.id, target.id);
            if (moved === dropped) return dropped;
            const parent = getNode(moved, target.id)!;
            let x: number;
            let y: number;
            if (parent.parentId === null) {
              x = parent.x + (getNode(moved, node.id)!.side === 'left' ? -H_GAP : H_GAP);
              y = n0.y + dy;
            } else {
              ({ x, y } = placeNewChild(cur, target.id));
            }
            // Put the node next to its new parent; the subtree follows.
            return moveSubtree(moved, node.id, x - (n0.x + dx), y - (n0.y + dy));
          });
          return;
        }
      }
      if (dx === 0 && dy === 0) return;
      state.apply((cur) => st.roots.reduce((acc, id) => moveSubtree(acc, id, dx, dy), cur));
    },
    [store, rf],
  );

  const onConnect = useCallback(
    (c: RFConnection) => {
      if (!c.source || !c.target) return;
      store.getState().apply((d) => addConnection(d, c.source, c.target)?.data ?? d);
    },
    [store],
  );

  const onNodeClick = useCallback(
    (_: unknown, node: MindFlowNode) => {
      if (connectFrom && node.id !== connectFrom) onConnectPick(node.id);
    },
    [connectFrom, onConnectPick],
  );

  // --- Viewport per viewer ---
  const initialViewport = useMemo(() => loadViewerState(mapKey).viewport, [mapKey]);
  const vpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMoveEnd = useCallback(
    (_: unknown, vp: { x: number; y: number; zoom: number }) => {
      if (vpTimer.current) clearTimeout(vpTimer.current);
      vpTimer.current = setTimeout(() => updateViewerState(mapKey, { viewport: vp }), 500);
    },
    [mapKey],
  );

  return (
    <ReactFlow<MindFlowNode, Edge>
      nodes={nodes}
      edges={derived.edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodeOrigin={[0.5, 0.5]}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onSelectionChange={onSelectionChange}
      onNodeDragStart={onNodeDragStart}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      onNodeClick={onNodeClick}
      onConnect={onConnect}
      onMoveEnd={onMoveEnd}
      connectionMode={ConnectionMode.Loose}
      connectionRadius={60}
      nodesConnectable={!readOnly}
      nodesDraggable={!readOnly}
      edgesFocusable={false}
      deleteKeyCode={null}
      selectionKeyCode="Shift"
      multiSelectionKeyCode="Shift"
      selectionOnDrag={false}
      panOnDrag
      panOnScroll={false}
      zoomOnDoubleClick={false}
      minZoom={0.1}
      maxZoom={2.5}
      defaultViewport={initialViewport}
      fitView={!initialViewport}
      fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
      proOptions={{ hideAttribution: true }}
      connectionLineStyle={{ stroke: 'var(--accent)', strokeWidth: 2 }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="var(--canvas-dot)" />
    </ReactFlow>
  );
}
